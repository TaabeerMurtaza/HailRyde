<?php

use App\Models\DriverProfile;
use App\Models\Ride;
use App\Models\User;
use Illuminate\Database\QueryException;

it('lists the preset places for a signed-in rider or driver', function (string $role) {
    $token = $this->postJson('/api/register', registration([
        'role' => $role,
        'plate' => 'LEA-1001',
        'category' => 'economy',
    ]))->assertCreated()->json('token');

    $response = $this->withToken($token)->getJson('/api/places')->assertOk();

    $places = $response->json('places');

    expect($places)->toHaveCount(8)
        ->and($places[0])->toBe([
            'id' => 'gulberg',
            'name' => 'Gulberg',
            'lat' => '31.520400',
            'lng' => '74.358700',
        ])
        ->and($places[4]['id'])->toBe('airport')
        ->and($places[4]['name'])->toBe('Allama Iqbal Airport');
})->with(['rider', 'driver']);

it('prices Gulberg to Airport from the documented formula', function (string $category, int $base, int $perKm, int $perMin) {
    $token = $this->postJson('/api/register', registration())->assertCreated()->json('token');

    $expected = quotedFare(31.520400, 74.358700, 31.521600, 74.403600, $base, $perKm, $perMin);

    if ($category === 'economy') {
        expect($expected)->toBe([
            'distance_km' => '4.26',
            'duration_min' => 10,
            'fare_amount' => '391.70',
        ]);
    }

    $this->withToken($token)->postJson('/api/estimates', [
        'pickup_place_id' => 'gulberg',
        'destination_place_id' => 'airport',
        'category' => $category,
        'fare_amount' => '1.00',
    ])->assertOk()
        ->assertExactJson([
            ...$expected,
            'currency' => 'PKR',
            'pickup_eta_min' => null,
        ]);
})->with([
    'economy' => ['economy', 150, 45, 5],
    'comfort' => ['comfort', 250, 70, 8],
]);

it('sets pickup eta from the nearest available driver in the same category', function () {
    $rider = $this->postJson('/api/register', registration())->assertCreated()->json('token');

    $near = $this->postJson('/api/register', registration([
        'email' => 'near@example.com',
        'role' => 'driver',
        'plate' => 'LEA-1001',
        'category' => 'economy',
    ]))->assertCreated()->json('user');

    $this->postJson('/api/register', registration([
        'email' => 'far@example.com',
        'role' => 'driver',
        'plate' => 'LEA-1002',
        'category' => 'economy',
    ]))->assertCreated();

    $this->postJson('/api/register', registration([
        'email' => 'comfort@example.com',
        'role' => 'driver',
        'plate' => 'LEA-2001',
        'category' => 'comfort',
    ]))->assertCreated();

    $this->postJson('/api/register', registration([
        'email' => 'offline@example.com',
        'role' => 'driver',
        'plate' => 'LEA-1003',
        'category' => 'economy',
    ]))->assertCreated();

    DriverProfile::query()->where('user_id', $near['id'])->update([
        'lat' => '31.520400',
        'lng' => '74.358700',
    ]);
    DriverProfile::query()->where('plate', 'LEA-1002')->update([
        'lat' => '31.469700',
        'lng' => '74.272800',
        'status' => 'available',
    ]);
    DriverProfile::query()->where('plate', 'LEA-1003')->update(['status' => 'offline']);

    $this->withToken($rider)->postJson('/api/estimates', [
        'pickup_place_id' => 'gulberg',
        'destination_place_id' => 'airport',
        'category' => 'economy',
    ])->assertOk()
        ->assertJsonPath('pickup_eta_min', 3);

    DriverProfile::query()->where('plate', 'LEA-1001')->update(['status' => 'on_trip']);

    $eta = max(3, (int) ceil(haversineKm(31.520400, 74.358700, 31.469700, 74.272800) / 25 * 60));

    $this->withToken($rider)->postJson('/api/estimates', [
        'pickup_place_id' => 'gulberg',
        'destination_place_id' => 'airport',
        'category' => 'economy',
    ])->assertOk()
        ->assertJsonPath('pickup_eta_min', $eta);

    expect($eta)->toBeGreaterThan(3);
});

it('rejects the same place twice and unknown place ids', function (array $body, string $field) {
    $token = $this->postJson('/api/register', registration())->assertCreated()->json('token');

    $this->withToken($token)->postJson('/api/estimates', $body)
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'validation_error')
        ->assertJsonPath('error.message', 'The given data was invalid.')
        ->assertJsonStructure(['error' => ['details' => [$field]]]);
})->with([
    'same place' => [[
        'pickup_place_id' => 'gulberg',
        'destination_place_id' => 'gulberg',
        'category' => 'economy',
    ], 'destination_place_id'],
    'unknown pickup' => [[
        'pickup_place_id' => 'mall-road',
        'destination_place_id' => 'airport',
        'category' => 'economy',
    ], 'pickup_place_id'],
    'unknown destination' => [[
        'pickup_place_id' => 'gulberg',
        'destination_place_id' => 'mall-road',
        'category' => 'economy',
    ], 'destination_place_id'],
]);

it('requires auth for places and estimates', function () {
    $this->getJson('/api/places')
        ->assertUnauthorized()
        ->assertJsonPath('error.code', 'unauthenticated');

    $this->postJson('/api/estimates', [
        'pickup_place_id' => 'gulberg',
        'destination_place_id' => 'airport',
        'category' => 'economy',
    ])->assertUnauthorized()
        ->assertJsonPath('error.code', 'unauthenticated');
});

it('allows one active ride per rider and one assignment per ride', function () {
    $rider = User::factory()->create();
    $other = User::factory()->create();
    $driver = User::factory()->create(['role' => 'driver']);

    $active = Ride::query()->create(rideRow($rider->id, 'requested', 'key-1'));
    Ride::query()->create(rideRow($rider->id, 'completed', 'key-2'));
    Ride::query()->create(rideRow($other->id, 'requested', 'key-1'));

    expect(fn () => Ride::query()->create(rideRow($rider->id, 'accepted', 'key-3')))
        ->toThrow(QueryException::class);

    $this->assertDatabaseCount('rides', 3);

    $active->assignment()->create([
        'driver_id' => $driver->id,
        'assigned_at' => now(),
    ]);

    expect(fn () => $active->assignment()->create([
        'driver_id' => $driver->id,
        'assigned_at' => now(),
    ]))->toThrow(QueryException::class);
});

function quotedFare(float $lat1, float $lng1, float $lat2, float $lng2, int $base, int $perKm, int $perMin): array
{
    $distanceKm = round(haversineKm($lat1, $lng1, $lat2, $lng2), 2);
    $durationMin = max(1, (int) round($distanceKm / 25 * 60));
    $fare = round($base + ($perKm * $distanceKm) + ($perMin * $durationMin), 2);

    return [
        'distance_km' => number_format($distanceKm, 2, '.', ''),
        'duration_min' => $durationMin,
        'fare_amount' => number_format($fare, 2, '.', ''),
    ];
}

function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
{
    $latFrom = deg2rad($lat1);
    $latTo = deg2rad($lat2);
    $latDelta = $latTo - $latFrom;
    $lngDelta = deg2rad($lng2 - $lng1);
    $a = sin($latDelta / 2) ** 2 + cos($latFrom) * cos($latTo) * sin($lngDelta / 2) ** 2;

    return 6371 * (2 * atan2(sqrt($a), sqrt(1 - $a)));
}

/**
 * @return array<string, mixed>
 */
function rideRow(int $riderId, string $status, string $key): array
{
    return [
        'rider_id' => $riderId,
        'pickup_place_id' => 'gulberg',
        'pickup_name' => 'Gulberg',
        'pickup_lat' => '31.520400',
        'pickup_lng' => '74.358700',
        'destination_place_id' => 'airport',
        'destination_name' => 'Allama Iqbal Airport',
        'destination_lat' => '31.521600',
        'destination_lng' => '74.403600',
        'category' => 'economy',
        'status' => $status,
        'distance_km' => '4.26',
        'duration_min' => 10,
        'pickup_eta_min' => 3,
        'fare_amount' => '391.70',
        'idempotency_key' => $key,
        'request_hash' => hash('sha256', $key),
    ];
}
