<?php

namespace App\Rides;

use App\Exceptions\NoRouteException;
use App\Exceptions\RouteUnavailableException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class OsrmRoadRouter implements RoadRouter
{
    public function drive(float $fromLat, float $fromLng, float $toLat, float $toLng): array
    {
        $url = $this->base().'/route/v1/driving/'
            .$fromLng.','.$fromLat.';'.$toLng.','.$toLat
            .'?overview=full&geometries=geojson';
        $body = $this->get($url);
        $route = $body['routes'][0] ?? null;

        if (! is_array($route) || ! isset($route['distance'], $route['duration'], $route['geometry'])) {
            throw new RouteUnavailableException;
        }

        return [
            'distance_m' => (float) $route['distance'],
            'duration_s' => (float) $route['duration'],
            'geometry' => $route['geometry'],
        ];
    }

    public function durationsTo(array $origins, float $lat, float $lng): array
    {
        $coords = [];

        foreach ($origins as $origin) {
            $coords[] = $origin['lng'].','.$origin['lat'];
        }

        $pickupIndex = count($coords);
        $coords[] = $lng.','.$lat;
        $sources = implode(';', range(0, max(0, $pickupIndex - 1)));
        $url = $this->base().'/table/v1/driving/'.implode(';', $coords)
            .'?sources='.$sources.'&destinations='.$pickupIndex.'&annotations=duration';
        $body = $this->get($url);
        $matrix = $body['durations'] ?? null;

        if (! is_array($matrix)) {
            throw new RouteUnavailableException;
        }

        $durations = [];

        foreach ($origins as $index => $origin) {
            $value = $matrix[$index][0] ?? null;
            $durations[] = is_numeric($value) ? (float) $value : null;
        }

        return $durations;
    }

    private function base(): string
    {
        return rtrim((string) config('services.osrm.url'), '/');
    }

    /**
     * @return array<string, mixed>
     */
    private function get(string $url): array
    {
        try {
            $response = Http::timeout(5)
                ->withHeaders(['User-Agent' => 'HailRyde'])
                ->get($url);
        } catch (ConnectionException) {
            throw new RouteUnavailableException;
        }

        if (! $response->successful()) {
            throw new RouteUnavailableException;
        }

        $body = $response->json();

        if (! is_array($body)) {
            throw new RouteUnavailableException;
        }

        $code = $body['code'] ?? '';

        if (in_array($code, ['NoRoute', 'NoSegment'], true)) {
            throw new NoRouteException;
        }

        if ($code !== 'Ok') {
            throw new RouteUnavailableException;
        }

        return $body;
    }
}
