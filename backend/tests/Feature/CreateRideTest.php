<?php

use App\Models\Ride;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Event;

it('creates a requested ride for a rider and ignores a client fare', function () {
    Event::fake([MessageLogged::class]);

    $token = $this->postJson('/api/register', registration())->assertCreated()->json('token');
    $expected = quotedFare(31.520400, 74.358700, 31.521600, 74.403600, 150, 45, 5);

    expect($expected)->toBe([
        'distance_km' => '4.26',
        'duration_min' => 10,
        'fare_amount' => '391.70',
    ]);

    $response = $this->withToken($token)->postJson('/api/rides', [
        'pickup_place_id' => 'gulberg',
        'destination_place_id' => 'airport',
        'category' => 'economy',
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
            'id' => 'gulberg',
            'name' => 'Gulberg',
            'lat' => '31.520400',
            'lng' => '74.358700',
        ])
        ->assertJsonPath('ride.destination.name', 'Allama Iqbal Airport')
        ->assertJsonPath('ride.rider.name', 'Ayesha Khan')
        ->assertJsonPath('ride.rider.phone', '03000000001')
        ->assertJsonPath('ride.accepted_at', null)
        ->assertJsonPath('ride.cancelled_at', null)
        ->assertJsonPath('ride.completed_at', null);

    expect(Ride::query()->count())->toBe(1)
        ->and(Ride::query()->value('fare_amount'))->toBe($expected['fare_amount']);

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

    $this->withToken($token)->postJson('/api/rides', [
        'pickup_place_id' => 'gulberg',
        'destination_place_id' => 'airport',
        'category' => 'economy',
    ], ['Idempotency-Key' => 'ride-1'])
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
    'invalid body' => [[
        'destination_place_id' => 'airport',
        'category' => 'economy',
    ], ['Idempotency-Key' => 'ride-1'], 'pickup_place_id'],
    'same place' => [[
        'pickup_place_id' => 'gulberg',
        'destination_place_id' => 'gulberg',
        'category' => 'economy',
    ], ['Idempotency-Key' => 'ride-1'], 'destination_place_id'],
    'missing key' => [[
        'pickup_place_id' => 'gulberg',
        'destination_place_id' => 'airport',
        'category' => 'economy',
    ], [], 'Idempotency-Key'],
]);

it('returns the original ride when the same idempotency key and body are repeated', function () {
    $token = $this->postJson('/api/register', registration())->assertCreated()->json('token');
    $body = [
        'pickup_place_id' => 'gulberg',
        'destination_place_id' => 'airport',
        'category' => 'economy',
    ];

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

    $this->withToken($token)->postJson('/api/rides', [
        'pickup_place_id' => 'gulberg',
        'destination_place_id' => 'airport',
        'category' => 'economy',
    ], ['Idempotency-Key' => 'ride-1'])->assertCreated();

    $this->withToken($token)->postJson('/api/rides', [
        'pickup_place_id' => 'gulberg',
        'destination_place_id' => 'liberty',
        'category' => 'economy',
    ], ['Idempotency-Key' => 'ride-1'])
        ->assertStatus(409)
        ->assertJsonPath('error.code', 'idempotency_conflict')
        ->assertJsonPath('error.details', []);

    expect(Ride::query()->count())->toBe(1);
});

it('returns active_ride_exists when the rider already has a requested or accepted ride', function (string $status) {
    $registered = $this->postJson('/api/register', registration())->assertCreated();
    $existing = Ride::query()->create(rideRow($registered->json('user.id'), $status, 'existing-key'));

    $this->withToken($registered->json('token'))->postJson('/api/rides', [
        'pickup_place_id' => 'gulberg',
        'destination_place_id' => 'liberty',
        'category' => 'comfort',
    ], ['Idempotency-Key' => 'new-key'])
        ->assertStatus(409)
        ->assertJsonPath('error.code', 'active_ride_exists')
        ->assertJsonPath('error.message', 'An active ride already exists.')
        ->assertJsonPath('error.details.ride_id', $existing->id);

    expect(Ride::query()->count())->toBe(1);
})->with(['requested', 'accepted']);
