<?php

use App\Http\Controllers\Api\V1\AuthController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::prefix('auth')->group(function () {
        Route::post('/send-otp', [AuthController::class, 'sendOtp'])
            ->middleware('throttle:5,1')
            ->name('api.v1.auth.send-otp');

        Route::post('/verify-otp', [AuthController::class, 'verifyOtp'])
            ->middleware('throttle:10,1')
            ->name('api.v1.auth.verify-otp');

        Route::post('/logout', [AuthController::class, 'logout'])
            ->middleware('auth:sanctum')
            ->name('api.v1.auth.logout');

        Route::get('/me', [AuthController::class, 'me'])
            ->middleware('auth:sanctum')
            ->name('api.v1.auth.me');
    });
});
