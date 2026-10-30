<?php

namespace App\Actions\Auth;

use App\Exceptions\InvalidCredentialsException;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class LoginUser
{
    /**
     * @return array{token: string, user: User}
     */
    public function __invoke(string $email, string $password): array
    {
        $user = User::query()->where('email', $email)->first();

        if ($user === null || ! Hash::check($password, $user->password)) {
            throw new InvalidCredentialsException;
        }

        return [
            'token' => $user->createToken('auth')->plainTextToken,
            'user' => $user->load('driverProfile'),
        ];
    }
}
