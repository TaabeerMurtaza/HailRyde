<?php

namespace App\Rides;

use App\Exceptions\RouteUnavailableException;

class FakeRoadRouter implements RoadRouter
{
    public int $lastOriginCount = 0;

    /**
     * @param  list<float>  $driverSeconds
     */
    public function __construct(
        private float $distanceM = 4200,
        private float $durationS = 600,
        private array $driverSeconds = [180],
        private ?\Throwable $driveFailure = null,
        private bool $failDrivers = false,
    ) {}

    public function drive(float $fromLat, float $fromLng, float $toLat, float $toLng): array
    {
        if ($this->driveFailure !== null) {
            throw $this->driveFailure;
        }

        return [
            'distance_m' => $this->distanceM,
            'duration_s' => $this->durationS,
            'geometry' => [
                'type' => 'LineString',
                'coordinates' => [[$fromLng, $fromLat], [$toLng, $toLat]],
            ],
        ];
    }

    public function durationsTo(array $origins, float $lat, float $lng): array
    {
        if ($this->failDrivers) {
            throw new RouteUnavailableException;
        }

        $this->lastOriginCount = count($origins);
        $last = $this->driverSeconds[array_key_last($this->driverSeconds)] ?? 180.0;
        $durations = [];

        foreach ($origins as $index => $origin) {
            $durations[] = (float) ($this->driverSeconds[$index] ?? $last);
        }

        return $durations;
    }
}
