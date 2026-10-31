<?php

namespace App\Actions\Rides;

use App\Exceptions\ForbiddenException;
use App\Exceptions\RideConflictException;
use App\Exceptions\RideNotFoundException;
use App\Models\Ride;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CancelRide
{
    public function __construct(private ReleaseOnTripDriver $release) {}

    public function __invoke(User $rider, string $rideId): Ride
    {
        if ($rider->role !== 'rider') {
            throw new ForbiddenException;
        }

        if (! ctype_digit($rideId)) {
            throw new RideNotFoundException;
        }

        return DB::transaction(function () use ($rider, $rideId) {
            $ride = Ride::query()->whereKey((int) $rideId)->lockForUpdate()->first();

            if ($ride === null) {
                throw new RideNotFoundException;
            }

            if ((int) $ride->rider_id !== (int) $rider->id) {
                throw new ForbiddenException;
            }

            if (! in_array($ride->status, ['requested', 'accepted'], true)) {
                throw RideConflictException::invalidTransition();
            }

            ($this->release)($ride);

            $ride->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
            ]);

            Log::info('Ride status transition.', [
                'ride_id' => $ride->id,
                'status' => 'cancelled',
            ]);

            return $ride->freshForResponse();
        });
    }
}
