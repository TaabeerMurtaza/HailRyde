<?php

namespace App\Actions\Rides;

class ListPlaces
{
    /**
     * @return list<array{id: string, name: string, lat: string, lng: string}>
     */
    public function __invoke(): array
    {
        $places = [];

        foreach (config('rides.places') as $id => $place) {
            $places[] = [
                'id' => $id,
                'name' => $place['name'],
                'lat' => $place['lat'],
                'lng' => $place['lng'],
            ];
        }

        return $places;
    }
}
