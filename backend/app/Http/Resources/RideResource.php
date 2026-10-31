<?php

namespace App\Http\Resources;

use App\Models\Ride;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Ride
 */
class RideResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'category' => $this->category,
            'pickup' => [
                'id' => $this->pickup_place_id,
                'name' => $this->pickup_name,
                'lat' => $this->pickup_lat,
                'lng' => $this->pickup_lng,
            ],
            'destination' => [
                'id' => $this->destination_place_id,
                'name' => $this->destination_name,
                'lat' => $this->destination_lat,
                'lng' => $this->destination_lng,
            ],
            'distance_km' => $this->distance_km,
            'duration_min' => $this->duration_min,
            'pickup_eta_min' => $this->pickup_eta_min,
            'fare_amount' => $this->fare_amount,
            'currency' => config('rides.currency'),
            'route' => $this->route,
            'rider' => $this->person($this->rider),
            'driver' => $this->driver(),
            'accepted_at' => $this->accepted_at?->toJSON(),
            'cancelled_at' => $this->cancelled_at?->toJSON(),
            'completed_at' => $this->completed_at?->toJSON(),
        ];
    }

    /**
     * @return array{id: int, name: string, phone: string}|null
     */
    private function person(?User $user): ?array
    {
        if ($user === null) {
            return null;
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
            'phone' => $user->phone,
        ];
    }

    /**
     * @return array{id: int, name: string, phone: string, plate: string, category: string, lat: string, lng: string}|null
     */
    private function driver(): ?array
    {
        $assignment = $this->assignment;
        $driver = $assignment?->driver;
        $profile = $driver?->driverProfile;

        if ($driver === null || $profile === null) {
            return null;
        }

        return [
            'id' => $driver->id,
            'name' => $driver->name,
            'phone' => $driver->phone,
            'plate' => $profile->plate,
            'category' => $profile->category,
            'lat' => $profile->lat,
            'lng' => $profile->lng,
        ];
    }
}
