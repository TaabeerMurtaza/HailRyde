<?php

namespace App\Actions\Rides;

use App\Exceptions\ForbiddenException;
use App\Exceptions\RideConflictException;
use App\Exceptions\RideNotFoundException;
use App\Models\DriverAssignment;
use App\Models\DriverProfile;
use App\Models\Ride;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AcceptRide
{
    public function __invoke(User $driver, string $rideId): Ride
    {
        if ($driver->role !== 'driver') {
            throw new ForbiddenException;
        }

        if (! ctype_digit($rideId)) {
            throw new RideNotFoundException;
        }

        return DB::transaction(function () use ($driver, $rideId) {
            $this->setLockTimeout();

            try {
                $ride = Ride::query()->whereKey((int) $rideId)->lockForUpdate()->first();
            } catch (QueryException $exception) {
                $this->throwIfLockTimeout($exception);
            }

            if ($ride === null) {
                throw new RideNotFoundException;
            }

            $assignedDriverId = DriverAssignment::query()->where('ride_id', $ride->id)->value('driver_id');

            if ($ride->status === 'accepted' && (int) $assignedDriverId === (int) $driver->id) {
                return $ride->freshForResponse();
            }

            if ($ride->status !== 'requested') {
                throw RideConflictException::invalidTransition();
            }

            try {
                $profile = DriverProfile::query()->where('user_id', $driver->id)->lockForUpdate()->first();
            } catch (QueryException $exception) {
                $this->throwIfLockTimeout($exception);
            }

            if ($profile === null || $profile->status !== 'available') {
                throw RideConflictException::driverUnavailable();
            }

            if ($profile->category !== $ride->category) {
                throw RideConflictException::categoryMismatch();
            }

            $ride->assignment()->create([
                'driver_id' => $driver->id,
                'assigned_at' => now(),
            ]);

            $ride->update([
                'status' => 'accepted',
                'accepted_at' => now(),
            ]);
            $profile->update(['status' => 'on_trip']);

            Log::info('Ride status transition.', [
                'ride_id' => $ride->id,
                'status' => 'accepted',
            ]);

            return $ride->freshForResponse();
        });
    }

    private function setLockTimeout(): void
    {
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement("set local lock_timeout = '3s'");
        }
    }

    private function throwIfLockTimeout(QueryException $exception): never
    {
        $sqlState = (string) ($exception->errorInfo[0] ?? $exception->getCode());

        if ($sqlState === '55P03' || str_contains(strtolower($exception->getMessage()), 'lock timeout')) {
            throw RideConflictException::lockTimeout();
        }

        throw $exception;
    }
}
