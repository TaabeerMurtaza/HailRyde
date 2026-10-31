<?php

use App\Models\DriverAssignment;
use App\Models\DriverProfile;
use App\Models\Ride;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

it('lists a rider rides newest first and can filter by status', function () {
    $rider = registerUser();
    $other = registerUser([
        'email' => 'other@example.com',
        'name' => 'Sana Iqbal',
        'phone' => '03000000003',
    ]);

    $older = Ride::query()->create(rideRow($rider['id'], 'cancelled', 'older'));
    $newer = Ride::query()->create(rideRow($rider['id'], 'requested', 'newer'));
    Ride::query()->create(rideRow($other['id'], 'requested', 'other'));

    $this->withToken($rider['token'])->getJson('/api/rides')
        ->assertOk()
        ->assertJsonPath('rides.0.id', $newer->id)
        ->assertJsonPath('rides.1.id', $older->id)
        ->assertJsonCount(2, 'rides');

    $this->withToken($rider['token'])->getJson('/api/rides?status=cancelled')
        ->assertOk()
        ->assertJsonCount(1, 'rides')
        ->assertJsonPath('rides.0.id', $older->id)
        ->assertJsonPath('rides.0.status', 'cancelled');
});

it('lists requested rides in the driver category oldest first', function () {
    $driver = registerUser([
        'email' => 'driver@example.com',
        'name' => 'Bilal Ahmed',
        'phone' => '03000000002',
        'role' => 'driver',
        'plate' => 'LEA-1001',
        'category' => 'economy',
    ]);
    $firstRider = registerUser();
    $secondRider = registerUser([
        'email' => 'second@example.com',
        'name' => 'Hassan Raza',
        'phone' => '03000000004',
    ]);
    $comfortRider = registerUser([
        'email' => 'comfort@example.com',
        'name' => 'Maria Qureshi',
        'phone' => '03000000005',
    ]);

    $older = Ride::query()->create(rideRow($firstRider['id'], 'requested', 'older'));
    $newer = Ride::query()->create(rideRow($secondRider['id'], 'requested', 'newer'));
    Ride::query()->create(array_merge(rideRow($comfortRider['id'], 'requested', 'comfort'), [
        'category' => 'comfort',
    ]));

    $this->withToken($driver['token'])->getJson('/api/rides')
        ->assertOk()
        ->assertJsonPath('rides.0.id', $older->id)
        ->assertJsonPath('rides.1.id', $newer->id)
        ->assertJsonCount(2, 'rides');

    $this->withToken($driver['token'])->getJson('/api/rides?status=requested')
        ->assertOk()
        ->assertJsonPath('rides.0.id', $older->id)
        ->assertJsonCount(2, 'rides');
});

it('lists accepted rides assigned to the driver', function () {
    $driver = registerUser(driverRegistration());
    $otherDriver = registerUser(driverRegistration([
        'email' => 'other-driver@example.com',
        'name' => 'Sana Iqbal',
        'phone' => '03000000003',
        'plate' => 'LEA-1002',
    ]));
    $rider = registerUser();
    $otherRider = registerUser([
        'email' => 'second@example.com',
        'name' => 'Hassan Raza',
        'phone' => '03000000004',
    ]);

    $mine = Ride::query()->create(rideRow($rider['id'], 'accepted', 'mine'));
    $theirs = Ride::query()->create(rideRow($otherRider['id'], 'accepted', 'theirs'));
    DriverAssignment::query()->create([
        'ride_id' => $mine->id,
        'driver_id' => $driver['id'],
        'assigned_at' => now(),
    ]);
    DriverAssignment::query()->create([
        'ride_id' => $theirs->id,
        'driver_id' => $otherDriver['id'],
        'assigned_at' => now(),
    ]);

    $this->withToken($driver['token'])->getJson('/api/rides?status=accepted')
        ->assertOk()
        ->assertJsonCount(1, 'rides')
        ->assertJsonPath('rides.0.id', $mine->id)
        ->assertJsonPath('rides.0.driver.id', $driver['id'])
        ->assertJsonPath('rides.0.driver.plate', 'LEA-1001');
});

it('shows a ride to its rider, the assigned driver, and a matching driver while requested', function () {
    $rider = registerUser();
    $stranger = registerUser([
        'email' => 'stranger@example.com',
        'name' => 'Omar Farooq',
        'phone' => '03000000006',
    ]);
    $driver = registerUser(driverRegistration());
    $comfortDriver = registerUser(driverRegistration([
        'email' => 'comfort-driver@example.com',
        'name' => 'Hassan Raza',
        'phone' => '03000000004',
        'plate' => 'LEA-2001',
        'category' => 'comfort',
    ]));
    $ride = Ride::query()->create(rideRow($rider['id'], 'requested', 'show'));

    $this->withToken($rider['token'])->getJson('/api/rides/'.$ride->id)
        ->assertOk()
        ->assertJsonPath('ride.id', $ride->id)
        ->assertJsonPath('ride.driver', null);

    $this->withToken($driver['token'])->getJson('/api/rides/'.$ride->id)
        ->assertOk()
        ->assertJsonPath('ride.status', 'requested');

    $this->withToken($comfortDriver['token'])->getJson('/api/rides/'.$ride->id)
        ->assertForbidden()
        ->assertJsonPath('error.code', 'forbidden');

    $this->withToken($stranger['token'])->getJson('/api/rides/'.$ride->id)
        ->assertForbidden()
        ->assertJsonPath('error.code', 'forbidden');

    $this->withToken($rider['token'])->getJson('/api/rides/999999')
        ->assertNotFound()
        ->assertJsonPath('error.code', 'not_found')
        ->assertJsonPath('error.message', 'Not found.')
        ->assertJsonPath('error.details', []);
});

it('hides an accepted ride from a driver who is not assigned', function () {
    $rider = registerUser();
    $assigned = registerUser(driverRegistration());
    $other = registerUser(driverRegistration([
        'email' => 'other-driver@example.com',
        'name' => 'Sana Iqbal',
        'phone' => '03000000003',
        'plate' => 'LEA-1002',
    ]));
    $ride = Ride::query()->create(rideRow($rider['id'], 'accepted', 'accepted'));
    DriverAssignment::query()->create([
        'ride_id' => $ride->id,
        'driver_id' => $assigned['id'],
        'assigned_at' => now(),
    ]);

    $this->withToken($assigned['token'])->getJson('/api/rides/'.$ride->id)
        ->assertOk()
        ->assertJsonPath('ride.driver.id', $assigned['id']);

    $this->withToken($other['token'])->getJson('/api/rides/'.$ride->id)
        ->assertForbidden()
        ->assertJsonPath('error.code', 'forbidden');
});

it('lets an available driver accept and forbids a rider', function () {
    Event::fake([MessageLogged::class]);

    $rider = registerUser();
    $driver = registerUser(driverRegistration());
    $ride = Ride::query()->create(rideRow($rider['id'], 'requested', 'accept'));

    $this->withToken($rider['token'])->postJson('/api/rides/'.$ride->id.'/accept')
        ->assertForbidden()
        ->assertJsonPath('error.code', 'forbidden')
        ->assertJsonPath('error.details', []);

    $response = $this->withToken($driver['token'])->postJson('/api/rides/'.$ride->id.'/accept')
        ->assertOk()
        ->assertJsonPath('ride.status', 'accepted')
        ->assertJsonPath('ride.driver.id', $driver['id'])
        ->assertJsonPath('ride.driver.name', 'Bilal Ahmed')
        ->assertJsonPath('ride.driver.phone', '03000000002')
        ->assertJsonPath('ride.driver.plate', 'LEA-1001')
        ->assertJsonPath('ride.driver.category', 'economy');

    expect($response->json('ride.accepted_at'))->toBeString()->not->toBeEmpty();
    expect(DriverProfile::query()->where('user_id', $driver['id'])->value('status'))->toBe('on_trip');
    expect(DriverAssignment::query()->where('ride_id', $ride->id)->count())->toBe(1);

    Event::assertDispatched(MessageLogged::class, function (MessageLogged $event) use ($ride) {
        return $event->level === 'info'
            && ($event->context['ride_id'] ?? null) === $ride->id
            && ($event->context['status'] ?? null) === 'accepted';
    });
});

it('returns the accepted ride when the same driver accepts again', function () {
    $rider = registerUser();
    $driver = registerUser(driverRegistration());
    $ride = Ride::query()->create(rideRow($rider['id'], 'requested', 'replay'));

    $this->withToken($driver['token'])->postJson('/api/rides/'.$ride->id.'/accept')->assertOk();
    $this->withToken($driver['token'])->postJson('/api/rides/'.$ride->id.'/accept')
        ->assertOk()
        ->assertJsonPath('ride.status', 'accepted')
        ->assertJsonPath('ride.driver.id', $driver['id']);

    expect(DriverAssignment::query()->count())->toBe(1);
});

it('rejects accept when the driver is offline or in another category', function (string $status, string $category, string $code) {
    $rider = registerUser();
    $driver = registerUser(driverRegistration([
        'category' => $category,
        'plate' => $category === 'comfort' ? 'LEA-2001' : 'LEA-1001',
    ]));
    DriverProfile::query()->where('user_id', $driver['id'])->update(['status' => $status]);
    $ride = Ride::query()->create(rideRow($rider['id'], 'requested', 'blocked'));

    $this->withToken($driver['token'])->postJson('/api/rides/'.$ride->id.'/accept')
        ->assertStatus(409)
        ->assertJsonPath('error.code', $code)
        ->assertJsonPath('error.details', []);

    expect(Ride::query()->find($ride->id)->status)->toBe('requested');
    expect(DriverAssignment::query()->count())->toBe(0);
})->with([
    'offline' => ['offline', 'economy', 'driver_unavailable'],
    'wrong category' => ['available', 'comfort', 'category_mismatch'],
]);

it('rejects invalid ride transitions', function (string $path, string $actor, string $status) {
    $rider = registerUser();
    $driver = registerUser(driverRegistration());
    $ride = Ride::query()->create(rideRow($rider['id'], $status, 'transition'));
    $token = $actor === 'rider' ? $rider['token'] : $driver['token'];

    $this->withToken($token)->postJson('/api/rides/'.$ride->id.$path)
        ->assertStatus(409)
        ->assertJsonPath('error.code', 'invalid_transition')
        ->assertJsonPath('error.details', []);

    expect(Ride::query()->find($ride->id)->status)->toBe($status);
})->with([
    'complete requested' => ['/complete', 'driver', 'requested'],
    'cancel completed' => ['/cancel', 'rider', 'completed'],
    'accept cancelled' => ['/accept', 'driver', 'cancelled'],
]);

it('cancels a requested ride for its rider and an accepted ride releases the driver', function () {
    $rider = registerUser();
    $other = registerUser([
        'email' => 'other@example.com',
        'name' => 'Sana Iqbal',
        'phone' => '03000000003',
    ]);
    $driver = registerUser(driverRegistration());
    $requested = Ride::query()->create(rideRow($rider['id'], 'requested', 'cancel-requested'));

    $this->withToken($driver['token'])->postJson('/api/rides/'.$requested->id.'/cancel')
        ->assertForbidden()
        ->assertJsonPath('error.code', 'forbidden');

    $this->withToken($other['token'])->postJson('/api/rides/'.$requested->id.'/cancel')
        ->assertForbidden();

    $this->withToken($rider['token'])->postJson('/api/rides/'.$requested->id.'/cancel')
        ->assertOk()
        ->assertJsonPath('ride.status', 'cancelled')
        ->assertJsonPath('ride.driver', null);

    expect(Ride::query()->find($requested->id)->cancelled_at)->not->toBeNull();

    $accepted = Ride::query()->create(rideRow($rider['id'], 'accepted', 'cancel-accepted'));
    DriverAssignment::query()->create([
        'ride_id' => $accepted->id,
        'driver_id' => $driver['id'],
        'assigned_at' => now(),
    ]);
    DriverProfile::query()->where('user_id', $driver['id'])->update(['status' => 'on_trip']);

    $this->withToken($rider['token'])->postJson('/api/rides/'.$accepted->id.'/cancel')
        ->assertOk()
        ->assertJsonPath('ride.status', 'cancelled');

    expect(DriverProfile::query()->where('user_id', $driver['id'])->value('status'))->toBe('available');
});

it('lets the assigned driver complete an accepted ride and releases that driver', function () {
    $rider = registerUser();
    $driver = registerUser(driverRegistration());
    $other = registerUser(driverRegistration([
        'email' => 'other-driver@example.com',
        'name' => 'Sana Iqbal',
        'phone' => '03000000003',
        'plate' => 'LEA-1002',
    ]));
    $ride = Ride::query()->create(rideRow($rider['id'], 'accepted', 'complete'));
    DriverAssignment::query()->create([
        'ride_id' => $ride->id,
        'driver_id' => $driver['id'],
        'assigned_at' => now(),
    ]);
    DriverProfile::query()->where('user_id', $driver['id'])->update(['status' => 'on_trip']);

    $this->withToken($rider['token'])->postJson('/api/rides/'.$ride->id.'/complete')
        ->assertForbidden()
        ->assertJsonPath('error.code', 'forbidden');

    $this->withToken($other['token'])->postJson('/api/rides/'.$ride->id.'/complete')
        ->assertForbidden()
        ->assertJsonPath('error.code', 'forbidden');

    $response = $this->withToken($driver['token'])->postJson('/api/rides/'.$ride->id.'/complete')
        ->assertOk()
        ->assertJsonPath('ride.status', 'completed')
        ->assertJsonPath('ride.driver.id', $driver['id']);

    expect($response->json('ride.completed_at'))->toBeString()->not->toBeEmpty();
    expect(DriverProfile::query()->where('user_id', $driver['id'])->value('status'))->toBe('available');
});

it('returns lock_timeout while another connection holds the ride for update', function () {
    if (config('database.default') !== 'pgsql') {
        $this->markTestSkipped('PostgreSQL row locks require DB_CONNECTION=pgsql.');
    }

    $rider = registerUser();
    $first = registerUser(driverRegistration());
    $second = registerUser(driverRegistration([
        'email' => 'second-driver@example.com',
        'name' => 'Sana Iqbal',
        'phone' => '03000000003',
        'plate' => 'LEA-1002',
    ]));
    $ride = Ride::query()->create(rideRow($rider['id'], 'requested', 'locked'));

    DB::commit();

    $config = config('database.connections.pgsql');
    $holder = new PDO(
        sprintf('pgsql:host=%s;port=%s;dbname=%s', $config['host'], $config['port'], $config['database']),
        $config['username'],
        $config['password'],
    );
    $holder->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $holder->beginTransaction();
    $locked = $holder->prepare('select id from rides where id = ? for update');
    $locked->execute([$ride->id]);

    try {
        $this->withToken($first['token'])->postJson('/api/rides/'.$ride->id.'/accept')
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'lock_timeout')
            ->assertJsonPath('error.details', []);

        $holder->commit();

        $this->withToken($first['token'])->postJson('/api/rides/'.$ride->id.'/accept')
            ->assertOk()
            ->assertJsonPath('ride.status', 'accepted')
            ->assertJsonPath('ride.driver.id', $first['id']);

        $this->withToken($second['token'])->postJson('/api/rides/'.$ride->id.'/accept')
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'invalid_transition')
            ->assertJsonPath('error.details', []);
    } finally {
        if ($holder->inTransaction()) {
            $holder->rollBack();
        }

        DB::table('driver_assignments')->delete();
        DB::table('rides')->delete();
        DB::table('personal_access_tokens')->delete();
        DB::table('driver_profiles')->delete();
        DB::table('users')->delete();

        if (DB::transactionLevel() === 0) {
            DB::beginTransaction();
        }
    }
});

/**
 * @param  array<string, mixed>  $overrides
 * @return array{token: string, id: int}
 */
function registerUser(array $overrides = []): array
{
    $response = test()->postJson('/api/register', registration($overrides))->assertCreated();

    return [
        'token' => $response->json('token'),
        'id' => $response->json('user.id'),
    ];
}

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function driverRegistration(array $overrides = []): array
{
    return array_merge([
        'email' => 'driver@example.com',
        'name' => 'Bilal Ahmed',
        'phone' => '03000000002',
        'role' => 'driver',
        'plate' => 'LEA-1001',
        'category' => 'economy',
    ], $overrides);
}
