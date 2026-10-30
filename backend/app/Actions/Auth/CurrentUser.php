<?php

namespace App\Actions\Auth;

use App\Models\User;

class CurrentUser
{
    public function __invoke(User $user): User
    {
        return $user->load('driverProfile');
    }
}
