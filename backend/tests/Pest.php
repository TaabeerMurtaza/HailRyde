<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class)->in('Feature');

function registration(array $overrides = []): array
{
    return array_merge([
        'name' => 'Ayesha Khan',
        'email' => 'ayesha@example.com',
        'password' => 'password',
        'phone' => '03000000001',
        'role' => 'rider',
    ], $overrides);
}

function fareFromRoute(float $meters, float $seconds, int $base, int $perKm, int $perMin): array
{
    $distanceKm = round($meters / 1000, 2);
    $durationMin = max(1, (int) round($seconds / 60));
    $fare = round($base + ($perKm * $distanceKm) + ($perMin * $durationMin), 2);

    return [
        'distance_km' => number_format($distanceKm, 2, '.', ''),
        'duration_min' => $durationMin,
        'fare_amount' => number_format($fare, 2, '.', ''),
    ];
}

function tripBody(array $overrides = []): array
{
    return array_merge([
        'pickup_lat' => 33.561778,
        'pickup_lng' => 73.148275,
        'destination_lat' => 33.59,
        'destination_lng' => 73.14,
        'category' => 'economy',
    ], $overrides);
}
