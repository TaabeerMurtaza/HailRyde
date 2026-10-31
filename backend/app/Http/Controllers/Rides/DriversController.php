<?php

namespace App\Http\Controllers\Rides;

use App\Actions\Rides\ListAvailableDrivers;
use App\Exceptions\ForbiddenException;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DriversController extends Controller
{
    public function __invoke(Request $request, ListAvailableDrivers $list): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->role !== 'rider') {
            throw new ForbiddenException;
        }

        $data = $request->validate([
            'category' => ['required', 'in:economy,comfort'],
        ]);

        return response()->json([
            'drivers' => $list($data['category']),
        ]);
    }
}
