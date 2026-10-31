<?php

namespace App\Http\Controllers\Rides;

use App\Actions\Rides\QuoteRide;
use App\Http\Controllers\Controller;
use App\Rides\RidePoints;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EstimateController extends Controller
{
    public function __invoke(Request $request, QuoteRide $quote): JsonResponse
    {
        $data = $request->validate(RidePoints::rules());
        $points = RidePoints::fromValidated($data);

        return response()->json($quote($points['pickup'], $points['destination'], $data['category']));
    }
}
