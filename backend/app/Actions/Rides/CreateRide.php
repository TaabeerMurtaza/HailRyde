<?php

namespace App\Actions\Rides;

use App\Exceptions\ActiveRideExistsException;
use App\Exceptions\IdempotencyConflictException;
use App\Models\Ride;
use App\Models\User;
use App\Rides\MapPoint;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CreateRide
{
    public function __construct(private QuoteRide $quote) {}

    /**
     * @return array{ride: Ride, created: bool}
     */
    public function __invoke(User $rider, string $idempotencyKey, MapPoint $pickup, MapPoint $destination, string $category): array
    {
        $hash = $this->requestHash($pickup, $destination, $category);

        try {
            $early = $this->existingOutcome($rider, $idempotencyKey, $hash);

            if ($early !== null) {
                return $early;
            }

            // The quote performs HTTP to OSRM, so it runs outside any transaction.
            $quote = ($this->quote)($pickup, $destination, $category);

            return DB::transaction(function () use ($rider, $idempotencyKey, $pickup, $destination, $category, $hash, $quote) {
                return $this->store($rider, $idempotencyKey, $pickup, $destination, $category, $hash, $quote);
            });
        } catch (QueryException $exception) {
            if (! $this->isUniqueViolation($exception)) {
                throw $exception;
            }

            return $this->afterUniqueViolation($rider, $idempotencyKey, $hash, $exception);
        }
    }

    /**
     * Returns the original ride for a matching replay, or null when the request is new.
     * Throws for an idempotency conflict or an existing active ride.
     *
     * @return array{ride: Ride, created: bool}|null
     */
    private function existingOutcome(User $rider, string $idempotencyKey, string $hash): ?array
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

        return null;
    }

    /**
     * @param  array{distance_km: string, duration_min: int, fare_amount: string, currency: string, pickup_eta_min: int|null, route: array<string, mixed>}  $quote
     * @return array{ride: Ride, created: bool}
     */
    private function store(User $rider, string $idempotencyKey, MapPoint $pickup, MapPoint $destination, string $category, string $hash, array $quote): array
    {
        $early = $this->existingOutcome($rider, $idempotencyKey, $hash);

        if ($early !== null) {
            return $early;
        }

        $ride = Ride::query()->create([
            'rider_id' => $rider->id,
            'pickup_place_id' => $pickup->placeId(),
            'pickup_name' => $pickup->name(),
            'pickup_lat' => $pickup->lat,
            'pickup_lng' => $pickup->lng,
            'destination_place_id' => $destination->placeId(),
            'destination_name' => $destination->name(),
            'destination_lat' => $destination->lat,
            'destination_lng' => $destination->lng,
            'category' => $category,
            'status' => 'requested',
            'distance_km' => $quote['distance_km'],
            'duration_min' => $quote['duration_min'],
            'pickup_eta_min' => $quote['pickup_eta_min'],
            'fare_amount' => $quote['fare_amount'],
            'route' => $quote['route'],
            'idempotency_key' => $idempotencyKey,
            'request_hash' => $hash,
        ]);

        Log::info('Ride status transition.', [
            'ride_id' => $ride->id,
            'status' => 'requested',
        ]);

        return ['ride' => $this->load($ride), 'created' => true];
    }

    private function requestHash(MapPoint $pickup, MapPoint $destination, string $category): string
    {
        $canonical = json_encode([
            'pickup_lat' => $pickup->lat,
            'pickup_lng' => $pickup->lng,
            'destination_lat' => $destination->lat,
            'destination_lng' => $destination->lng,
            'category' => $category,
        ], JSON_THROW_ON_ERROR);

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
