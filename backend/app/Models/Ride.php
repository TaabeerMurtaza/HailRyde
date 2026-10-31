<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'rider_id',
    'pickup_place_id',
    'pickup_name',
    'pickup_lat',
    'pickup_lng',
    'destination_place_id',
    'destination_name',
    'destination_lat',
    'destination_lng',
    'category',
    'status',
    'distance_km',
    'duration_min',
    'pickup_eta_min',
    'fare_amount',
    'idempotency_key',
    'request_hash',
    'accepted_at',
    'cancelled_at',
    'completed_at',
])]
class Ride extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'pickup_lat' => 'decimal:6',
            'pickup_lng' => 'decimal:6',
            'destination_lat' => 'decimal:6',
            'destination_lng' => 'decimal:6',
            'distance_km' => 'decimal:2',
            'fare_amount' => 'decimal:2',
            'duration_min' => 'integer',
            'pickup_eta_min' => 'integer',
            'accepted_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function rider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rider_id');
    }

    /**
     * @return HasOne<DriverAssignment, $this>
     */
    public function assignment(): HasOne
    {
        return $this->hasOne(DriverAssignment::class);
    }

    public function freshForResponse(): static
    {
        return $this->refresh()->load([
            'rider',
            'assignment.driver.driverProfile',
        ]);
    }
}
