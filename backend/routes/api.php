<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Auth\MeController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Rides\AcceptRideController;
use App\Http\Controllers\Rides\CancelRideController;
use App\Http\Controllers\Rides\CompleteRideController;
use App\Http\Controllers\Rides\CreateRideController;
use App\Http\Controllers\Rides\DriversController;
use App\Http\Controllers\Rides\EstimateController;
use App\Http\Controllers\Rides\ListRidesController;
use App\Http\Controllers\Rides\ShowRideController;
use Illuminate\Support\Facades\Route;

Route::post('/register', RegisterController::class);
Route::post('/login', LoginController::class);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', LogoutController::class);
    Route::get('/me', MeController::class);
    Route::get('/drivers', DriversController::class);
    Route::post('/estimates', EstimateController::class);
    Route::get('/rides', ListRidesController::class);
    Route::post('/rides', CreateRideController::class);
    Route::get('/rides/{id}', ShowRideController::class);
    Route::post('/rides/{id}/accept', AcceptRideController::class);
    Route::post('/rides/{id}/cancel', CancelRideController::class);
    Route::post('/rides/{id}/complete', CompleteRideController::class);
});
