<?php

namespace App\Http;

use Illuminate\Http\JsonResponse;

class ApiError
{
    /**
     * @param  array<string, list<string>>  $details
     */
    public static function response(string $code, string $message, array $details = [], int $status = 400): JsonResponse
    {
        return response()->json([
            'error' => [
                'code' => $code,
                'message' => $message,
                'details' => $details === [] ? (object) [] : $details,
            ],
        ], $status);
    }
}
