<?php

namespace App\Http\Controllers\Rides;

use App\Actions\Rides\CreateRide;
use App\Exceptions\ForbiddenException;
use App\Http\Controllers\Controller;
use App\Http\Resources\RideResource;
use App\Models\User;
use App\Rides\RidePoints;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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

        $data = $request->validate(RidePoints::rules());
        $points = RidePoints::fromValidated($data);

        $idempotencyKey = $request->headers->get('Idempotency-Key');

        if (! is_string($idempotencyKey) || mb_strlen($idempotencyKey) < 1 || mb_strlen($idempotencyKey) > 255) {
            throw ValidationException::withMessages([
                'Idempotency-Key' => ['The Idempotency-Key must be between 1 and 255 characters.'],
            ]);
        }

        $result = $create($user, $idempotencyKey, $points['pickup'], $points['destination'], $data['category']);

        return response()->json([
            'ride' => (new RideResource($result['ride']))->resolve(),
        ], $result['created'] ? 201 : 200);
    }
}
