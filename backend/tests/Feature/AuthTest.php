<?php

it('registers a rider and returns a token', function () {
    $response = $this->postJson('/api/register', registration());

    $response->assertCreated()
        ->assertJsonPath('user.id', 1)
        ->assertJsonPath('user.name', 'Ayesha Khan')
        ->assertJsonPath('user.email', 'ayesha@example.com')
        ->assertJsonPath('user.phone', '03000000001')
        ->assertJsonPath('user.role', 'rider')
        ->assertJsonPath('user.driver_profile', null)
        ->assertJsonMissingPath('user.password');

    expect($response->json('token'))->toBeString()->not->toBeEmpty();

    $this->assertDatabaseHas('users', [
        'email' => 'ayesha@example.com',
        'role' => 'rider',
        'phone' => '03000000001',
    ]);
    $this->assertDatabaseCount('driver_profiles', 0);

    $this->withToken($response->json('token'))
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('user.email', 'ayesha@example.com');
});

it('registers a driver with an available profile at Gulberg', function () {
    $response = $this->postJson('/api/register', registration([
        'email' => 'bilal@example.com',
        'role' => 'driver',
        'plate' => 'LEA-1001',
        'category' => 'economy',
    ]));

    $response->assertCreated()
        ->assertJsonPath('user.role', 'driver')
        ->assertJsonPath('user.driver_profile.plate', 'LEA-1001')
        ->assertJsonPath('user.driver_profile.category', 'economy')
        ->assertJsonPath('user.driver_profile.status', 'available')
        ->assertJsonPath('user.driver_profile.lat', '31.520400')
        ->assertJsonPath('user.driver_profile.lng', '74.358700');

    $this->assertDatabaseCount('driver_profiles', 1);
    $this->assertDatabaseCount('users', 1);
});

it('returns validation_error when a driver omits plate or category', function (array $payload) {
    $this->postJson('/api/register', $payload)
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'validation_error')
        ->assertJsonPath('error.message', 'The given data was invalid.')
        ->assertJsonStructure(['error' => ['code', 'message', 'details']]);

    $this->assertDatabaseCount('users', 0);
    $this->assertDatabaseCount('driver_profiles', 0);
})->with([
    'missing plate' => [fn () => registration(['role' => 'driver', 'category' => 'economy'])],
    'missing category' => [fn () => registration(['role' => 'driver', 'plate' => 'LEA-1001'])],
    'missing both' => [fn () => registration(['role' => 'driver'])],
]);

it('ignores plate and category sent by a rider', function () {
    $this->postJson('/api/register', registration([
        'plate' => 'LEA-9999',
        'category' => 'not-a-category',
    ]))->assertCreated()
        ->assertJsonPath('user.role', 'rider')
        ->assertJsonPath('user.driver_profile', null);

    $this->assertDatabaseCount('driver_profiles', 0);
});

it('returns validation_error for a duplicate email', function () {
    $this->postJson('/api/register', registration())->assertCreated();

    $response = $this->postJson('/api/register', registration([
        'name' => 'Someone Else',
    ]));

    $response->assertUnprocessable()
        ->assertJsonPath('error.code', 'validation_error')
        ->assertJsonPath('error.message', 'The given data was invalid.')
        ->assertJsonPath('error.details.email.0', 'The email has already been taken.');

    expect($response->getContent())->toContain('"details":{');
});

it('returns validation_error when registration input is too short', function (array $payload, string $field) {
    $this->postJson('/api/register', $payload)
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'validation_error')
        ->assertJsonStructure(['error' => ['details' => [$field]]]);
})->with([
    'password' => [fn () => registration(['password' => 'short']), 'password'],
    'phone' => [fn () => registration(['phone' => '123456']), 'phone'],
]);

it('logs in with the same body shape as register', function () {
    $this->postJson('/api/register', registration([
        'role' => 'driver',
        'plate' => 'LEA-1001',
        'category' => 'comfort',
    ]))->assertCreated();

    $response = $this->postJson('/api/login', [
        'email' => 'ayesha@example.com',
        'password' => 'password',
    ]);

    $response->assertOk()
        ->assertJsonPath('user.role', 'driver')
        ->assertJsonPath('user.driver_profile.plate', 'LEA-1001')
        ->assertJsonPath('user.driver_profile.category', 'comfort');

    expect($response->json('token'))->toBeString()->not->toBeEmpty();
});

it('returns invalid_credentials for an unknown login', function () {
    $response = $this->postJson('/api/login', [
        'email' => 'missing@example.com',
        'password' => 'password',
    ]);

    $response->assertUnauthorized()
        ->assertJsonPath('error.code', 'invalid_credentials')
        ->assertJsonPath('error.details', []);

    expect($response->getContent())->toContain('"details":{}');
});

it('returns invalid_credentials for a wrong password', function () {
    $this->postJson('/api/register', registration())->assertCreated();

    $this->postJson('/api/login', [
        'email' => 'ayesha@example.com',
        'password' => 'wrong-password',
    ])->assertUnauthorized()
        ->assertJsonPath('error.code', 'invalid_credentials');
});

it('revokes the current token on logout', function () {
    $token = $this->postJson('/api/register', registration())->assertCreated()->json('token');

    $this->withToken($token)->postJson('/api/logout')->assertNoContent();

    $this->app['auth']->forgetGuards();

    $this->withToken($token)->getJson('/api/me')
        ->assertUnauthorized()
        ->assertJsonPath('error.code', 'unauthenticated');
});

it('returns the current user from me', function () {
    $token = $this->postJson('/api/register', registration())->assertCreated()->json('token');

    $this->withToken($token)->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('user.name', 'Ayesha Khan')
        ->assertJsonPath('user.driver_profile', null)
        ->assertJsonMissingPath('token');
});

it('returns unauthenticated when the bearer token is missing or invalid', function () {
    $this->getJson('/api/me')
        ->assertUnauthorized()
        ->assertJsonPath('error.code', 'unauthenticated')
        ->assertJsonPath('error.details', []);

    $this->withToken('not-a-real-token')->postJson('/api/logout')
        ->assertUnauthorized()
        ->assertJsonPath('error.code', 'unauthenticated');
});

it('seeds the local demo accounts', function () {
    $this->seed();

    $accounts = [
        ['rider@hailryde.test', 'Ayesha Khan', '03000000001', 'rider', null],
        ['economy1@hailryde.test', 'Bilal Ahmed', '03000000002', 'driver', ['plate' => 'LEA-1001', 'category' => 'economy', 'status' => 'available', 'lat' => '31.520400', 'lng' => '74.358700']],
        ['economy2@hailryde.test', 'Sana Iqbal', '03000000003', 'driver', ['plate' => 'LEA-1002', 'category' => 'economy', 'status' => 'available', 'lat' => '31.469700', 'lng' => '74.272800']],
        ['comfort1@hailryde.test', 'Hassan Raza', '03000000004', 'driver', ['plate' => 'LEA-2001', 'category' => 'comfort', 'status' => 'available', 'lat' => '31.461800', 'lng' => '74.406600']],
        ['comfort2@hailryde.test', 'Maria Qureshi', '03000000005', 'driver', ['plate' => 'LEA-2002', 'category' => 'comfort', 'status' => 'available', 'lat' => '31.521600', 'lng' => '74.403600']],
        ['offline@hailryde.test', 'Omar Farooq', '03000000006', 'driver', ['plate' => 'LEA-1003', 'category' => 'economy', 'status' => 'offline', 'lat' => '31.483600', 'lng' => '74.316600']],
    ];

    foreach ($accounts as [$email, $name, $phone, $role, $profile]) {
        $response = $this->postJson('/api/login', [
            'email' => $email,
            'password' => 'password',
        ])->assertOk()
            ->assertJsonPath('user.name', $name)
            ->assertJsonPath('user.phone', $phone)
            ->assertJsonPath('user.role', $role);

        if ($profile === null) {
            $response->assertJsonPath('user.driver_profile', null);
        } else {
            foreach ($profile as $key => $value) {
                $response->assertJsonPath('user.driver_profile.'.$key, $value);
            }
        }
    }
});
