<?php

namespace App\Actions\Rides;

use App\Exceptions\ForbiddenException;
use App\Exceptions\RideConflictException;
use App\Exceptions\RideNotFoundException;
use App\Models\Ride;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CompleteRide
{
    public function __construct(private ReleaseOnTripDriver $release) {}

    public function __invoke(User $driver, string $rideId): Ride
    {
        if ($driver->role !== 'driver') {
            throw new ForbiddenException;
        }

        if (! ctype_digit($rideId)) {
            throw new RideNotFoundException;
        }

        return DB::transaction(function () use ($driver, $rideId) {
            $ride = Ride::query()->whereKey((int) $rideId)->lockForUpdate()->first();

            if ($ride === null) {
                throw new RideNotFoundException;
            }

            if ($ride->status !== 'accepted') {
                throw RideConflictException::invalidTransition();
            }

            $assignedDriverId = $ride->assignment()->value('driver_id');

            if ((int) $assignedDriverId !== (int) $driver->id) {
                throw new ForbiddenException;
            }

            ($this->release)($ride);

            $ride->update([
                'status' => 'completed',
                'completed_at' => now(),
            ]);

            Log::info('Ride status transition.', [
                'ride_id' => $ride->id,
                'status' => 'completed',
            ]);

            return $ride->freshForResponse();
        });
    }
}
