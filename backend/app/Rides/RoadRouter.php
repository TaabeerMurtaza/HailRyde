<?php

namespace App\Rides;

interface RoadRouter
{
    /**
     * @return array{distance_m: float, duration_s: float, geometry: array{type: string, coordinates: list<array{0: float, 1: float}>}}
     */
    public function drive(float $fromLat, float $fromLng, float $toLat, float $toLng): array;

    /**
     * @param  list<array{lat: float, lng: float}>  $origins
     * @return list<float|null>
     */
    public function durationsTo(array $origins, float $lat, float $lng): array;
}
