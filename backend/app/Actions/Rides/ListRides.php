<?php

namespace App\Actions\Rides;

use App\Models\Ride;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

class ListRides
{
    /**
     * @return Collection<int, Ride>
     */
    public function __invoke(User $user, ?string $status): Collection
    {
        $query = Ride::query()->with([
            'rider',
            'assignment.driver.driverProfile',
        ]);

        if ($user->role === 'rider') {
            $query->where('rider_id', $user->id);

            if ($status !== null) {
                $query->where('status', $status);
            }

            return $query->orderByDesc('id')->get();
        }

        if ($status === 'accepted') {
            return $query
                ->where('status', 'accepted')
                ->whereHas('assignment', fn ($assignment) => $assignment->where('driver_id', $user->id))
                ->orderByDesc('id')
                ->get();
        }

        if ($status !== null && $status !== 'requested') {
            return new Collection;
        }

        return $query
            ->where('status', 'requested')
            ->where('category', $user->driverProfile?->category)
            ->orderBy('id')
            ->get();
    }
}
