<?php

namespace App\Http\Controllers\Rides;

use App\Actions\Rides\CancelRide;
use App\Http\Controllers\Controller;
use App\Http\Resources\RideResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CancelRideController extends Controller
{
    public function __invoke(Request $request, string $id, CancelRide $cancel): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'ride' => (new RideResource($cancel($user, $id)))->resolve(),
        ]);
    }
}
