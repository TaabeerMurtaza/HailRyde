<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Auth\RegisterUser;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RegisterController extends Controller
{
    public function __invoke(Request $request, RegisterUser $register): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'phone' => ['required', 'string', 'min:7', 'max:20'],
            'role' => ['required', 'string', 'in:rider,driver'],
            'plate' => ['exclude_unless:role,driver', 'required', 'string', 'max:20'],
            'category' => ['exclude_unless:role,driver', 'required', 'string', 'in:economy,comfort'],
        ]);

        $result = $register($data);

        return response()->json([
            'token' => $result['token'],
            'user' => (new UserResource($result['user']))->resolve(),
        ], 201);
    }
}
