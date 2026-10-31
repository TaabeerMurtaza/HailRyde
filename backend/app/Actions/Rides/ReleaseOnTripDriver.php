<?php

namespace App\Actions\Rides;

use App\Models\DriverProfile;
use App\Models\Ride;

class ReleaseOnTripDriver
{
    public function __invoke(Ride $ride): void
    {
        $driverId = $ride->assignment()->value('driver_id');

        if ($driverId === null) {
            return;
        }

        $profile = DriverProfile::query()->where('user_id', $driverId)->lockForUpdate()->first();

        if ($profile !== null && $profile->status === 'on_trip') {
            $profile->update(['status' => 'available']);
        }
    }
}
