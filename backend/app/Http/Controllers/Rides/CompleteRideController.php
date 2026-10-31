<?php

namespace App\Http\Controllers\Rides;

use App\Actions\Rides\CompleteRide;
use App\Http\Controllers\Controller;
use App\Http\Resources\RideResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CompleteRideController extends Controller
{
    public function __invoke(Request $request, string $id, CompleteRide $complete): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'ride' => (new RideResource($complete($user, $id)))->resolve(),
        ]);
    }
}
