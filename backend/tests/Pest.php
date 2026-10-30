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
