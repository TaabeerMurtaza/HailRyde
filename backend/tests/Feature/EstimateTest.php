<?php

use App\Exceptions\NoRouteException;
use App\Exceptions\RouteUnavailableException;
use App\Models\DriverProfile;
use App\Models\Ride;
use App\Models\User;
use App\Rides\FakeRoadRouter;
use App\Rides\RoadRouter;
use Illuminate\Database\QueryException;

it('prices a road route from the documented formula and ignores a client fare', function (string $category, int $base, int $perKm, int $perMin) {
    $token = $this->postJson('/api/register', registration())->assertCreated()->json('token');
    $expected = fareFromRoute(4200, 600, $base, $perKm, $perMin);

    if ($category === 'economy') {
        expect($expected)->toBe([
            'distance_km' => '4.20',
            'duration_min' => 10,
            'fare_amount' => '389.00',
        ]);
    }

    $this->withToken($token)->postJson('/api/estimates', [
        ...tripBody(['category' => $category]),
        'fare_amount' => '1.00',
    ])->assertOk()
        ->assertExactJson([
            ...$expected,
            'currency' => 'PKR',
            'pickup_eta_min' => null,
            'route' => [
                'type' => 'LineString',
                'coordinates' => [[73.148275, 33.561778], [73.14, 33.59]],
            ],
        ]);
})->with([
    'economy' => ['economy', 150, 45, 5],
    'comfort' => ['comfort', 250, 70, 8],
]);

it('sets pickup eta from the shortest road time to an available driver in the same category', function () {
    $router = new FakeRoadRouter(driverSeconds: [240, 900]);
    $this->app->instance(RoadRouter::class, $router);

    $token = $this->postJson('/api/register', registration())->assertCreated()->json('token');

    $this->postJson('/api/register', registration([
        'email' => 'near@example.com',
        'role' => 'driver',
        'plate' => 'LEA-1001',
        'category' => 'economy',
    ]))->assertCreated();

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

    $offline = $this->postJson('/api/register', registration([
        'email' => 'offline@example.com',
        'role' => 'driver',
        'plate' => 'LEA-1003',
        'category' => 'economy',
    ]))->assertCreated()->json('user');

    DriverProfile::query()->where('user_id', $offline['id'])->update(['status' => 'offline']);

    $this->withToken($token)->postJson('/api/estimates', tripBody())
        ->assertOk()
        ->assertJsonPath('pickup_eta_min', 4);

    expect($router->lastOriginCount)->toBe(2);
});

it('does not ask the router for driver times when no driver is available', function () {
    $router = Mockery::mock(RoadRouter::class);
    $router->shouldReceive('drive')->once()->andReturn((new FakeRoadRouter)->drive(33.561778, 73.148275, 33.59, 73.14));
    $router->shouldNotReceive('durationsTo');
    $this->app->instance(RoadRouter::class, $router);

    $token = $this->postJson('/api/register', registration())->assertCreated()->json('token');

    $this->withToken($token)->postJson('/api/estimates', tripBody())
        ->assertOk()
        ->assertJsonPath('pickup_eta_min', null);
});

it('accepts a trip inside Soan Gardens', function () {
    $token = $this->postJson('/api/register', registration())->assertCreated()->json('token');

    $this->withToken($token)->postJson('/api/estimates', [
        'pickup_lat' => 33.561778,
        'pickup_lng' => 73.148275,
        'destination_lat' => 33.590000,
        'destination_lng' => 73.140000,
        'category' => 'economy',
    ])->assertOk()
        ->assertJsonPath('route.type', 'LineString');
});

it('rejects coordinates outside the service area and a repeated pin', function (array $body, string $field) {
    $token = $this->postJson('/api/register', registration())->assertCreated()->json('token');

    $this->withToken($token)->postJson('/api/estimates', $body)
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'validation_error')
        ->assertJsonStructure(['error' => ['details' => [$field]]]);
})->with([
    'outside' => [tripBody(['pickup_lat' => 30]), 'pickup_lat'],
    'lahore' => [tripBody([
        'pickup_lat' => 31.5204,
        'pickup_lng' => 74.3587,
        'destination_lat' => 31.5216,
        'destination_lng' => 74.4036,
    ]), 'pickup_lat'],
    'same pin' => [tripBody([
        'destination_lat' => 33.561778,
        'destination_lng' => 73.148275,
    ]), 'destination_lat'],
]);

it('returns no_route when the driving path does not exist', function () {
    $this->app->instance(RoadRouter::class, new FakeRoadRouter(driveFailure: new NoRouteException));
    $token = $this->postJson('/api/register', registration())->assertCreated()->json('token');

    $this->withToken($token)->postJson('/api/estimates', tripBody())
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'no_route')
        ->assertJsonPath('error.message', 'Those points are not connected by a road.');
});

it('returns route_unavailable when the router cannot be reached', function () {
    $this->app->instance(RoadRouter::class, new FakeRoadRouter(driveFailure: new RouteUnavailableException));
    $token = $this->postJson('/api/register', registration())->assertCreated()->json('token');

    $this->withToken($token)->postJson('/api/estimates', tripBody())
        ->assertStatus(503)
        ->assertJsonPath('error.code', 'route_unavailable')
        ->assertJsonPath('error.message', 'Road routing is unavailable.');
});

it('requires auth for estimates', function () {
    $this->postJson('/api/estimates', tripBody())
        ->assertUnauthorized()
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
