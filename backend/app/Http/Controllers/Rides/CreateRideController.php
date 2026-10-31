<?php

namespace App\Http\Controllers\Rides;

use App\Actions\Rides\CreateRide;
use App\Exceptions\ForbiddenException;
use App\Http\Controllers\Controller;
use App\Http\Resources\RideResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CreateRideController extends Controller
{
    public function __invoke(Request $request, CreateRide $create): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->role !== 'rider') {
            throw new ForbiddenException;
        }

        $placeIds = array_keys(config('rides.places'));

        $data = $request->validate([
            'pickup_place_id' => ['required', 'string', Rule::in($placeIds)],
            'destination_place_id' => ['required', 'string', 'different:pickup_place_id', Rule::in($placeIds)],
            'category' => ['required', 'string', Rule::in(array_keys(config('rides.categories')))],
        ]);

        $idempotencyKey = $request->headers->get('Idempotency-Key');

        if (! is_string($idempotencyKey) || mb_strlen($idempotencyKey) < 1 || mb_strlen($idempotencyKey) > 255) {
            throw ValidationException::withMessages([
                'Idempotency-Key' => ['The Idempotency-Key must be between 1 and 255 characters.'],
            ]);
        }

        $result = $create($user, $idempotencyKey, $data);

        return response()->json([
            'ride' => (new RideResource($result['ride']))->resolve(),
        ], $result['created'] ? 201 : 200);
    }
}
