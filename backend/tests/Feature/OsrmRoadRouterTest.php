<?php

use App\Exceptions\NoRouteException;
use App\Exceptions\RouteUnavailableException;
use App\Rides\OsrmRoadRouter;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

it('reads driving distance, duration, and geometry from OSRM', function () {
    Http::fake([
        'https://router.project-osrm.org/route/v1/driving/*' => Http::response([
            'code' => 'Ok',
            'routes' => [[
                'distance' => 4200.4,
                'duration' => 600.2,
                'geometry' => [
                    'type' => 'LineString',
                    'coordinates' => [[74.3587, 31.5204], [74.4036, 31.5216]],
                ],
            ]],
        ]),
    ]);

    $route = (new OsrmRoadRouter)->drive(31.5204, 74.3587, 31.5216, 74.4036);

    expect($route['distance_m'])->toBe(4200.4)
        ->and($route['duration_s'])->toBe(600.2)
        ->and($route['geometry']['type'])->toBe('LineString');

    Http::assertSent(function ($request) {
        return str_contains($request->url(), '/route/v1/driving/74.3587,31.5204;74.4036,31.5216')
            && str_contains($request->url(), 'overview=full')
            && str_contains($request->url(), 'geometries=geojson')
            && $request->hasHeader('User-Agent', 'HailRyde');
    });
});

it('turns an OSRM NoRoute code into NoRouteException', function () {
    Http::fake([
        'https://router.project-osrm.org/route/v1/driving/*' => Http::response(['code' => 'NoRoute']),
    ]);

    expect(fn () => (new OsrmRoadRouter)->drive(31.52, 74.35, 31.53, 74.36))
        ->toThrow(NoRouteException::class, 'Those points are not connected by a road.');
});

it('turns a connection failure into RouteUnavailableException', function () {
    Http::fake(function () {
        throw new ConnectionException('timed out');
    });

    expect(fn () => (new OsrmRoadRouter)->drive(31.52, 74.35, 31.53, 74.36))
        ->toThrow(RouteUnavailableException::class, 'Road routing is unavailable.');
});

it('reads one duration per driver from the OSRM table', function () {
    Http::fake([
        'https://router.project-osrm.org/table/v1/driving/*' => Http::response([
            'code' => 'Ok',
            'durations' => [[240.0], [null]],
        ]),
    ]);

    $durations = (new OsrmRoadRouter)->durationsTo([
        ['lat' => 31.47, 'lng' => 74.27],
        ['lat' => 31.51, 'lng' => 74.34],
    ], 31.5204, 74.3587);

    expect($durations)->toBe([240.0, null]);

    Http::assertSent(function ($request) {
        return str_contains($request->url(), '/table/v1/driving/74.27,31.47;74.34,31.51;74.3587,31.5204')
            && str_contains($request->url(), 'sources=0;1')
            && str_contains($request->url(), 'destinations=2')
            && str_contains($request->url(), 'annotations=duration');
    });
});
