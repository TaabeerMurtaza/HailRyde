<?php

namespace App\Http\Controllers\Rides;

use App\Actions\Rides\QuoteRide;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EstimateController extends Controller
{
    public function __invoke(Request $request, QuoteRide $quote): JsonResponse
    {
        $placeIds = array_keys(config('rides.places'));

        $data = $request->validate([
            'pickup_place_id' => ['required', 'string', Rule::in($placeIds)],
            'destination_place_id' => ['required', 'string', 'different:pickup_place_id', Rule::in($placeIds)],
            'category' => ['required', 'string', Rule::in(array_keys(config('rides.categories')))],
        ]);

        return response()->json($quote(
            $data['pickup_place_id'],
            $data['destination_place_id'],
            $data['category'],
        ));
    }
}
