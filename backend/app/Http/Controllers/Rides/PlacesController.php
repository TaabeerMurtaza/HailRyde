<?php

namespace App\Http\Controllers\Rides;

use App\Actions\Rides\ListPlaces;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class PlacesController extends Controller
{
    public function __invoke(ListPlaces $listPlaces): JsonResponse
    {
        return response()->json([
            'places' => $listPlaces(),
        ]);
    }
}
