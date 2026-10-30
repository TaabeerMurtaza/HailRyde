<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Auth\CurrentUser;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends Controller
{
    public function __invoke(Request $request, CurrentUser $currentUser): JsonResponse
    {
        return response()->json([
            'user' => (new UserResource($currentUser($request->user())))->resolve(),
        ]);
    }
}
