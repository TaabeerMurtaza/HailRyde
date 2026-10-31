<?php

use App\Models\DriverProfile;

it('lists available drivers in the requested category for a rider', function () {
    $rider = $this->postJson('/api/register', registration())->assertCreated()->json('token');

    $economy = $this->postJson('/api/register', registration([
        'email' => 'economy@example.com',
        'role' => 'driver',
        'plate' => 'LEA-1001',
        'category' => 'economy',
    ]))->assertCreated()->json('user');

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

    $this->withToken($rider)->getJson('/api/drivers?category=economy')
        ->assertOk()
        ->assertExactJson([
            'drivers' => [[
                'id' => $economy['id'],
                'lat' => '31.520400',
                'lng' => '74.358700',
                'category' => 'economy',
            ]],
        ]);
});

it('forbids a driver from listing driver locations', function () {
    $token = $this->postJson('/api/register', registration([
        'role' => 'driver',
        'plate' => 'LEA-1001',
        'category' => 'economy',
    ]))->assertCreated()->json('token');

    $this->withToken($token)->getJson('/api/drivers?category=economy')
        ->assertForbidden()
        ->assertJsonPath('error.code', 'forbidden');
});

it('rejects a missing driver category', function () {
    $token = $this->postJson('/api/register', registration())->assertCreated()->json('token');

    $this->withToken($token)->getJson('/api/drivers')
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'validation_error')
        ->assertJsonStructure(['error' => ['details' => ['category']]]);
});
