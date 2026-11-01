<?php

use App\Exceptions\RouteUnavailableException;
use App\Models\Ride;
use App\Rides\FakeRoadRouter;
use App\Rides\RoadRouter;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

it('creates a requested ride for a rider and ignores a client fare', function () {
    Event::fake([MessageLogged::class]);

    $token = $this->postJson('/api/register', registration())->assertCreated()->json('token');
    $expected = fareFromRoute(4200, 600, 150, 45, 5);

    $response = $this->withToken($token)->postJson('/api/rides', [
        ...tripBody(),
        'fare_amount' => '1.00',
    ], ['Idempotency-Key' => 'ride-1'])->assertCreated();

    $response->assertJsonPath('ride.status', 'requested')
        ->assertJsonPath('ride.category', 'economy')
        ->assertJsonPath('ride.distance_km', $expected['distance_km'])
        ->assertJsonPath('ride.duration_min', $expected['duration_min'])
        ->assertJsonPath('ride.fare_amount', $expected['fare_amount'])
        ->assertJsonPath('ride.currency', 'PKR')
        ->assertJsonPath('ride.pickup_eta_min', null)
        ->assertJsonPath('ride.driver', null)
        ->assertJsonPath('ride.pickup', [
            'id' => '33.561778,73.148275',
            'name' => '33.561778, 73.148275',
            'lat' => '33.561778',
            'lng' => '73.148275',
        ])
        ->assertJsonPath('ride.destination.name', '33.590000, 73.140000')
        ->assertJsonPath('ride.route.type', 'LineString')
        ->assertJsonPath('ride.rider.name', 'Ayesha Khan')
        ->assertJsonPath('ride.rider.phone', '03000000001')
        ->assertJsonPath('ride.accepted_at', null)
        ->assertJsonPath('ride.cancelled_at', null)
        ->assertJsonPath('ride.completed_at', null);

    expect(Ride::query()->count())->toBe(1)
        ->and(Ride::query()->value('fare_amount'))->toBe($expected['fare_amount']);

    $canonical = json_encode([
        'pickup_lat' => '33.561778',
        'pickup_lng' => '73.148275',
        'destination_lat' => '33.590000',
        'destination_lng' => '73.140000',
        'category' => 'economy',
    ], JSON_THROW_ON_ERROR);

    expect(Ride::query()->value('request_hash'))->toBe(hash('sha256', $canonical));

    $rideId = $response->json('ride.id');

    Event::assertDispatched(MessageLogged::class, function (MessageLogged $event) use ($rideId) {
        return $event->level === 'info'
            && ($event->context['ride_id'] ?? null) === $rideId
            && ($event->context['status'] ?? null) === 'requested';
    });
});

it('forbids a driver from creating a ride', function () {
    $token = $this->postJson('/api/register', registration([
        'role' => 'driver',
        'plate' => 'LEA-1001',
        'category' => 'economy',
    ]))->assertCreated()->json('token');

    $this->withToken($token)->postJson('/api/rides', tripBody(), ['Idempotency-Key' => 'ride-1'])
        ->assertForbidden()
        ->assertJsonPath('error.code', 'forbidden')
        ->assertJsonPath('error.message', 'Forbidden.')
        ->assertJsonPath('error.details', []);

    expect(Ride::query()->count())->toBe(0);
});

it('rejects invalid ride input', function (array $body, array $headers, string $field) {
    $token = $this->postJson('/api/register', registration())->assertCreated()->json('token');

    $this->withToken($token)->postJson('/api/rides', $body, $headers)
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'validation_error')
        ->assertJsonPath('error.message', 'The given data was invalid.')
        ->assertJsonStructure(['error' => ['details' => [$field]]]);

    expect(Ride::query()->count())->toBe(0);
})->with([
    'invalid body' => [tripBody(['pickup_lat' => null]), ['Idempotency-Key' => 'ride-1'], 'pickup_lat'],
    'same place' => [tripBody([
        'destination_lat' => 33.561778,
        'destination_lng' => 73.148275,
    ]), ['Idempotency-Key' => 'ride-1'], 'destination_lat'],
    'missing key' => [tripBody(), [], 'Idempotency-Key'],
]);

it('returns the original ride when the same idempotency key and body are repeated', function () {
    $token = $this->postJson('/api/register', registration())->assertCreated()->json('token');
    $body = tripBody();

    $created = $this->withToken($token)->postJson('/api/rides', $body, ['Idempotency-Key' => 'ride-1'])
        ->assertCreated()
        ->json('ride.id');

    $replay = $this->withToken($token)->postJson('/api/rides', $body, ['Idempotency-Key' => 'ride-1'])
        ->assertOk()
        ->json('ride.id');

    expect($replay)->toBe($created)
        ->and(Ride::query()->count())->toBe(1);
});

it('returns idempotency_conflict when the same key is sent with a different destination', function () {
    $token = $this->postJson('/api/register', registration())->assertCreated()->json('token');

    $this->withToken($token)->postJson('/api/rides', tripBody(), ['Idempotency-Key' => 'ride-1'])->assertCreated();

    $this->withToken($token)->postJson('/api/rides', tripBody(['destination_lat' => 33.5685, 'destination_lng' => 73.16]), ['Idempotency-Key' => 'ride-1'])
        ->assertStatus(409)
        ->assertJsonPath('error.code', 'idempotency_conflict')
        ->assertJsonPath('error.details', []);

    expect(Ride::query()->count())->toBe(1);
});

it('returns active_ride_exists when the rider already has a requested or accepted ride', function (string $status) {
    $registered = $this->postJson('/api/register', registration())->assertCreated();
    $existing = Ride::query()->create(rideRow($registered->json('user.id'), $status, 'existing-key'));

    $this->withToken($registered->json('token'))->postJson('/api/rides', tripBody(['category' => 'comfort']), ['Idempotency-Key' => 'new-key'])
        ->assertStatus(409)
        ->assertJsonPath('error.code', 'active_ride_exists')
        ->assertJsonPath('error.message', 'An active ride already exists.')
        ->assertJsonPath('error.details.ride_id', $existing->id);

    expect(Ride::query()->count())->toBe(1);
})->with(['requested', 'accepted']);

it('quotes the route outside the create transaction', function () {
    $token = $this->postJson('/api/register', registration())->assertCreated()->json('token');

    // RefreshDatabase keeps the test inside one transaction, so compare with that baseline.
    $baseline = DB::transactionLevel();
    $levels = [];

    $router = new class($levels) extends FakeRoadRouter
    {
        public function __construct(private array &$levels)
        {
            parent::__construct();
        }

        public function drive(float $fromLat, float $fromLng, float $toLat, float $toLng): array
        {
            $this->levels[] = DB::transactionLevel();

            return parent::drive($fromLat, $fromLng, $toLat, $toLng);
        }
    };
    $this->app->instance(RoadRouter::class, $router);

    $this->withToken($token)->postJson('/api/rides', tripBody(), ['Idempotency-Key' => 'ride-1'])
        ->assertCreated()
        ->assertJsonPath('ride.route.type', 'LineString');

    expect($levels)->toBe([$baseline])
        ->and(Ride::query()->value('route'))->not->toBeNull();
});

it('replays an existing ride without a successful router call', function () {
    $token = $this->postJson('/api/register', registration())->assertCreated()->json('token');
    $created = $this->withToken($token)->postJson('/api/rides', tripBody(), ['Idempotency-Key' => 'ride-1'])
        ->assertCreated()
        ->json('ride.id');

    $this->app->instance(RoadRouter::class, new FakeRoadRouter(driveFailure: new RouteUnavailableException));

    $this->withToken($token)->postJson('/api/rides', tripBody(), ['Idempotency-Key' => 'ride-1'])
        ->assertOk()
        ->assertJsonPath('ride.id', $created);

    expect(Ride::query()->count())->toBe(1);
});
