<?php

namespace App\Http\Controllers\Rides;

use App\Actions\Rides\AcceptRide;
use App\Http\Controllers\Controller;
use App\Http\Resources\RideResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AcceptRideController extends Controller
{
    public function __invoke(Request $request, string $id, AcceptRide $accept): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'ride' => (new RideResource($accept($user, $id)))->resolve(),
        ]);
    }
}
