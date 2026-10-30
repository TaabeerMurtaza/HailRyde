<?php

namespace App\Actions\Auth;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class RegisterUser
{
    private const GULBERG_LAT = '31.520400';

    private const GULBERG_LNG = '74.358700';

    /**
     * @param  array{name: string, email: string, password: string, phone: string, role: string, plate?: string, category?: string}  $input
     * @return array{token: string, user: User}
     */
    public function __invoke(array $input): array
    {
        return DB::transaction(function () use ($input) {
            $user = User::query()->create([
                'name' => $input['name'],
                'email' => $input['email'],
                'password' => $input['password'],
                'phone' => $input['phone'],
                'role' => $input['role'],
            ]);

            if ($user->role === 'driver') {
                $user->driverProfile()->create([
                    'plate' => $input['plate'],
                    'category' => $input['category'],
                    'status' => 'available',
                    'lat' => self::GULBERG_LAT,
                    'lng' => self::GULBERG_LNG,
                ]);
            }

            $token = $user->createToken('auth')->plainTextToken;

            return [
                'token' => $token,
                'user' => $user->load('driverProfile'),
            ];
        });
    }
}
