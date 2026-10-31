<?php

namespace App\Http\Controllers\Rides;

use App\Actions\Rides\ListRides;
use App\Http\Controllers\Controller;
use App\Http\Resources\RideResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ListRidesController extends Controller
{
    public function __invoke(Request $request, ListRides $list): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $status = $request->query('status');

        $rides = $list($user, is_string($status) && $status !== '' ? $status : null);

        return response()->json([
            'rides' => RideResource::collection($rides)->resolve(),
        ]);
    }
}
