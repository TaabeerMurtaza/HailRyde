<?php

use App\Exceptions\ActiveRideExistsException;
use App\Exceptions\ForbiddenException;
use App\Exceptions\IdempotencyConflictException;
use App\Exceptions\InvalidCredentialsException;
use App\Exceptions\NoRouteException;
use App\Exceptions\RideConflictException;
use App\Exceptions\RideNotFoundException;
use App\Exceptions\RouteUnavailableException;
use App\Http\ApiError;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (InvalidCredentialsException $exception, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::response('invalid_credentials', 'These credentials do not match our records.', status: 401);
            }
        });

        $exceptions->render(function (ValidationException $exception, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::response('validation_error', 'The given data was invalid.', $exception->errors(), 422);
            }
        });

        $exceptions->render(function (AuthenticationException $exception, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::response('unauthenticated', 'Unauthenticated.', status: 401);
            }
        });

        $exceptions->render(function (ForbiddenException $exception, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::response('forbidden', $exception->getMessage(), status: 403);
            }
        });

        $exceptions->render(function (IdempotencyConflictException $exception, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::response('idempotency_conflict', $exception->getMessage(), status: 409);
            }
        });

        $exceptions->render(function (ActiveRideExistsException $exception, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::response('active_ride_exists', $exception->getMessage(), ['ride_id' => $exception->rideId], 409);
            }
        });

        $exceptions->render(function (RideConflictException $exception, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::response($exception->errorCode, $exception->getMessage(), status: 409);
            }
        });

        $exceptions->render(function (RideNotFoundException $exception, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::response('not_found', $exception->getMessage(), status: 404);
            }
        });

        $exceptions->render(function (NoRouteException $exception, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::response('no_route', $exception->getMessage(), status: 422);
            }
        });

        $exceptions->render(function (RouteUnavailableException $exception, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::response('route_unavailable', $exception->getMessage(), status: 503);
            }
        });
    })->create();
