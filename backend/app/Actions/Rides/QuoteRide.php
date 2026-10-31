<?php

namespace App\Actions\Rides;

use App\Exceptions\NoRouteException;
use App\Exceptions\RouteUnavailableException;
use App\Models\DriverProfile;
use App\Rides\MapPoint;
use App\Rides\RoadRouter;

class QuoteRide
{
    public function __construct(private RoadRouter $router) {}

    /**
     * @return array{distance_km: string, duration_min: int, fare_amount: string, currency: string, pickup_eta_min: int|null, route: array<string, mixed>}
     */
    public function __invoke(MapPoint $pickup, MapPoint $destination, string $category): array
    {
        $trip = $this->router->drive(
            (float) $pickup->lat,
            (float) $pickup->lng,
            (float) $destination->lat,
            (float) $destination->lng,
        );
        $distanceKm = round($trip['distance_m'] / 1000, 2);
        $durationMin = max(1, (int) round($trip['duration_s'] / 60));
        $rates = config('rides.categories.'.$category);
        $fare = round($rates['base'] + ($rates['per_km'] * $distanceKm) + ($rates['per_min'] * $durationMin), 2);

        return [
            'distance_km' => $this->money($distanceKm),
            'duration_min' => $durationMin,
            'fare_amount' => $this->money($fare),
            'currency' => config('rides.currency'),
            'pickup_eta_min' => $this->pickupEtaMin($pickup, $category),
            'route' => $trip['geometry'],
        ];
    }

    private function pickupEtaMin(MapPoint $pickup, string $category): ?int
    {
        $drivers = DriverProfile::query()
            ->where('status', 'available')
            ->where('category', $category)
            ->get(['lat', 'lng']);

        if ($drivers->isEmpty()) {
            return null;
        }

        $origins = $drivers
            ->map(fn (DriverProfile $driver) => ['lat' => (float) $driver->lat, 'lng' => (float) $driver->lng])
            ->all();

        try {
            $seconds = $this->router->durationsTo($origins, (float) $pickup->lat, (float) $pickup->lng);
        } catch (NoRouteException|RouteUnavailableException) {
            return null;
        }

        $finite = array_filter($seconds, fn ($value) => is_float($value) && is_finite($value));

        if ($finite === []) {
            return null;
        }

        return max(3, (int) ceil(min($finite) / 60));
    }

    private function money(float $amount): string
    {
        return number_format($amount, 2, '.', '');
    }
}
