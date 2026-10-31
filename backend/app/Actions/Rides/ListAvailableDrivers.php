<?php

namespace App\Actions\Rides;

use App\Models\DriverProfile;

class ListAvailableDrivers
{
    /**
     * @return list<array{id: int, lat: string, lng: string, category: string}>
     */
    public function __invoke(string $category): array
    {
        return DriverProfile::query()
            ->where('status', 'available')
            ->where('category', $category)
            ->get()
            ->map(fn (DriverProfile $profile): array => [
                'id' => (int) $profile->user_id,
                'lat' => $profile->lat,
                'lng' => $profile->lng,
                'category' => $profile->category,
            ])
            ->all();
    }
}
