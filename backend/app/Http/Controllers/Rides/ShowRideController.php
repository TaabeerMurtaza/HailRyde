<?php

namespace App\Http\Controllers\Rides;

use App\Actions\Rides\ShowRide;
use App\Http\Controllers\Controller;
use App\Http\Resources\RideResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShowRideController extends Controller
{
    public function __invoke(Request $request, string $id, ShowRide $show): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'ride' => (new RideResource($show($user, $id)))->resolve(),
        ]);
    }
}
