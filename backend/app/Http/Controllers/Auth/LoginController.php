<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Auth\LoginUser;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LoginController extends Controller
{
    public function __invoke(Request $request, LoginUser $login): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $result = $login($data['email'], $data['password']);

        return response()->json([
            'token' => $result['token'],
            'user' => (new UserResource($result['user']))->resolve(),
        ]);
    }
}
