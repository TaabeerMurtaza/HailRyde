<?php

namespace App\Actions\Rides;

use App\Exceptions\ForbiddenException;
use App\Exceptions\RideNotFoundException;
use App\Models\Ride;
use App\Models\User;

class ShowRide
{
    public function __invoke(User $user, string $rideId): Ride
    {
        $ride = $this->find($rideId);

        if ($user->role === 'rider' && (int) $ride->rider_id === (int) $user->id) {
            return $ride;
        }

        $assignedDriverId = $ride->assignment?->driver_id;

        if ($assignedDriverId !== null && (int) $assignedDriverId === (int) $user->id) {
            return $ride;
        }

        if (
            $user->role === 'driver'
            && $ride->status === 'requested'
            && $user->driverProfile?->category === $ride->category
        ) {
            return $ride;
        }

        throw new ForbiddenException;
    }

    private function find(string $rideId): Ride
    {
        if (! ctype_digit($rideId)) {
            throw new RideNotFoundException;
        }

        $ride = Ride::query()
            ->with(['rider', 'assignment.driver.driverProfile'])
            ->find((int) $rideId);

        if ($ride === null) {
            throw new RideNotFoundException;
        }

        return $ride;
    }
}
