<?php

namespace App\Actions\Rides;

use App\Models\DriverProfile;

class QuoteRide
{
    /**
     * @return array{distance_km: string, duration_min: int, fare_amount: string, currency: string, pickup_eta_min: int|null}
     */
    public function __invoke(string $pickupPlaceId, string $destinationPlaceId, string $category): array
    {
        $places = config('rides.places');
        $pickup = $places[$pickupPlaceId];
        $destination = $places[$destinationPlaceId];
        $speed = (float) config('rides.speed_kmh');
        $distanceKm = round($this->haversineKm(
            (float) $pickup['lat'],
            (float) $pickup['lng'],
            (float) $destination['lat'],
            (float) $destination['lng'],
        ), 2);
        $durationMin = max(1, (int) round($distanceKm / $speed * 60));
        $rates = config('rides.categories.'.$category);
        $fare = round($rates['base'] + ($rates['per_km'] * $distanceKm) + ($rates['per_min'] * $durationMin), 2);

        return [
            'distance_km' => $this->money($distanceKm),
            'duration_min' => $durationMin,
            'fare_amount' => $this->money($fare),
            'currency' => config('rides.currency'),
            'pickup_eta_min' => $this->pickupEtaMin(
                (float) $pickup['lat'],
                (float) $pickup['lng'],
                $category,
                $speed,
            ),
        ];
    }

    private function pickupEtaMin(float $lat, float $lng, string $category, float $speed): ?int
    {
        $nearestKm = null;

        $drivers = DriverProfile::query()
            ->where('status', 'available')
            ->where('category', $category)
            ->get(['lat', 'lng']);

        foreach ($drivers as $driver) {
            $km = $this->haversineKm($lat, $lng, (float) $driver->lat, (float) $driver->lng);

            if ($nearestKm === null || $km < $nearestKm) {
                $nearestKm = $km;
            }
        }

        if ($nearestKm === null) {
            return null;
        }

        return max(3, (int) ceil($nearestKm / $speed * 60));
    }

    private function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $radius = (float) config('rides.earth_radius_km');
        $latFrom = deg2rad($lat1);
        $latTo = deg2rad($lat2);
        $latDelta = $latTo - $latFrom;
        $lngDelta = deg2rad($lng2 - $lng1);
        $a = sin($latDelta / 2) ** 2 + cos($latFrom) * cos($latTo) * sin($lngDelta / 2) ** 2;

        return $radius * (2 * atan2(sqrt($a), sqrt(1 - $a)));
    }

    private function money(float $amount): string
    {
        return number_format($amount, 2, '.', '');
    }
}
