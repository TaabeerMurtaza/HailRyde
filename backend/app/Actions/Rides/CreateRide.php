<?php

namespace App\Actions\Rides;

use App\Exceptions\ActiveRideExistsException;
use App\Exceptions\IdempotencyConflictException;
use App\Models\Ride;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CreateRide
{
    public function __construct(private QuoteRide $quote) {}

    /**
     * @param  array{pickup_place_id: string, destination_place_id: string, category: string}  $input
     * @return array{ride: Ride, created: bool}
     */
    public function __invoke(User $rider, string $idempotencyKey, array $input): array
    {
        $hash = $this->requestHash($input);

        try {
            return DB::transaction(function () use ($rider, $idempotencyKey, $input, $hash) {
                return $this->store($rider, $idempotencyKey, $input, $hash);
            });
        } catch (QueryException $exception) {
            if (! $this->isUniqueViolation($exception)) {
                throw $exception;
            }

            return $this->afterUniqueViolation($rider, $idempotencyKey, $hash, $exception);
        }
    }

    /**
     * @param  array{pickup_place_id: string, destination_place_id: string, category: string}  $input
     * @return array{ride: Ride, created: bool}
     */
    private function store(User $rider, string $idempotencyKey, array $input, string $hash): array
    {
        $replay = $this->matchingReplay($rider, $idempotencyKey, $hash);

        if ($replay !== null) {
            return ['ride' => $this->load($replay), 'created' => false];
        }

        $active = Ride::query()
            ->where('rider_id', $rider->id)
            ->whereIn('status', ['requested', 'accepted'])
            ->first();

        if ($active !== null) {
            throw new ActiveRideExistsException($active->id);
        }

        $quote = ($this->quote)(
            $input['pickup_place_id'],
            $input['destination_place_id'],
            $input['category'],
        );
        $places = config('rides.places');
        $pickup = $places[$input['pickup_place_id']];
        $destination = $places[$input['destination_place_id']];

        $ride = Ride::query()->create([
            'rider_id' => $rider->id,
            'pickup_place_id' => $input['pickup_place_id'],
            'pickup_name' => $pickup['name'],
            'pickup_lat' => $pickup['lat'],
            'pickup_lng' => $pickup['lng'],
            'destination_place_id' => $input['destination_place_id'],
            'destination_name' => $destination['name'],
            'destination_lat' => $destination['lat'],
            'destination_lng' => $destination['lng'],
            'category' => $input['category'],
            'status' => 'requested',
            'distance_km' => $quote['distance_km'],
            'duration_min' => $quote['duration_min'],
            'pickup_eta_min' => $quote['pickup_eta_min'],
            'fare_amount' => $quote['fare_amount'],
            'idempotency_key' => $idempotencyKey,
            'request_hash' => $hash,
        ]);

        Log::info('Ride status transition.', [
            'ride_id' => $ride->id,
            'status' => 'requested',
        ]);

        return ['ride' => $this->load($ride), 'created' => true];
    }

    /**
     * @param  array{pickup_place_id: string, destination_place_id: string, category: string}  $input
     */
    private function requestHash(array $input): string
    {
        $canonical = json_encode([
            'pickup_place_id' => $input['pickup_place_id'],
            'destination_place_id' => $input['destination_place_id'],
            'category' => $input['category'],
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);

        return hash('sha256', $canonical);
    }

    private function matchingReplay(User $rider, string $idempotencyKey, string $hash): ?Ride
    {
        $existing = Ride::query()
            ->where('rider_id', $rider->id)
            ->where('idempotency_key', $idempotencyKey)
            ->first();

        if ($existing === null) {
            return null;
        }

        if (! hash_equals($existing->request_hash, $hash)) {
            throw new IdempotencyConflictException;
        }

        return $existing;
    }

    /**
     * @return array{ride: Ride, created: bool}
     */
    private function afterUniqueViolation(User $rider, string $idempotencyKey, string $hash, QueryException $exception): array
    {
        $replay = $this->matchingReplay($rider, $idempotencyKey, $hash);

        if ($replay !== null) {
            return ['ride' => $this->load($replay), 'created' => false];
        }

        $active = Ride::query()
            ->where('rider_id', $rider->id)
            ->whereIn('status', ['requested', 'accepted'])
            ->first();

        if ($active !== null) {
            throw new ActiveRideExistsException($active->id);
        }

        throw $exception;
    }

    private function isUniqueViolation(QueryException $exception): bool
    {
        $sqlState = (string) ($exception->errorInfo[0] ?? '');

        return in_array($sqlState, ['23000', '23505'], true);
    }

    private function load(Ride $ride): Ride
    {
        return $ride->load(['rider', 'assignment.driver.driverProfile']);
    }
}
