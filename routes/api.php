<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\ClientOrderController;
use App\Http\Controllers\Api\V1\ClientProfileController;
use App\Http\Controllers\Api\V1\DriverController;
use App\Http\Controllers\Api\V1\DriverProfileController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::prefix('auth')->group(function () {
        Route::post('/send-otp', [AuthController::class, 'sendOtp'])
            ->middleware('throttle:5,1')
            ->name('api.v1.auth.send-otp');

        Route::post('/verify-otp', [AuthController::class, 'verifyOtp'])
            ->middleware('throttle:10,1')
            ->name('api.v1.auth.verify-otp');

        Route::post('/driver-login', [AuthController::class, 'driverLogin'])
            ->middleware('throttle:10,1')
            ->name('api.v1.auth.driver-login');

        Route::post('/logout', [AuthController::class, 'logout'])
            ->middleware('auth:sanctum')
            ->name('api.v1.auth.logout');

        Route::get('/me', [AuthController::class, 'me'])
            ->middleware('auth:sanctum')
            ->name('api.v1.auth.me');

        Route::put('/push-token', [AuthController::class, 'updatePushToken'])
            ->middleware('auth:sanctum')
            ->name('api.v1.auth.push-token');

        Route::post('/change-phone/send-otp', [AuthController::class, 'changePhoneSendOtp'])
            ->middleware(['auth:sanctum', 'throttle:5,1'])
            ->name('api.v1.auth.change-phone.send-otp');

        Route::post('/change-phone/verify', [AuthController::class, 'changePhoneVerify'])
            ->middleware(['auth:sanctum', 'throttle:10,1'])
            ->name('api.v1.auth.change-phone.verify');
    });
});

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    // Client routes
    Route::prefix('client')->middleware('role:client')->group(function () {
        Route::get('/orders/active', [ClientOrderController::class, 'active'])->name('api.v1.client.orders.active');
        Route::get('/orders', [ClientOrderController::class, 'index'])->name('api.v1.client.orders.index');
        Route::post('/orders', [ClientOrderController::class, 'store'])->name('api.v1.client.orders.store');
        Route::get('/orders/{order}', [ClientOrderController::class, 'show'])->name('api.v1.client.orders.show');
        Route::post('/orders/{order}/cancel', [ClientOrderController::class, 'cancel'])->name('api.v1.client.orders.cancel');
        Route::put('/profile', [ClientProfileController::class, 'update'])->name('api.v1.client.profile.update');
    });

    // Driver routes
    Route::prefix('driver')->middleware('role:driver')->group(function () {
        Route::post('/go-online', [DriverController::class, 'goOnline'])->name('api.v1.driver.go-online');
        Route::post('/go-offline', [DriverController::class, 'goOffline'])->name('api.v1.driver.go-offline');
        Route::post('/location', [DriverController::class, 'updateLocation'])->name('api.v1.driver.location');
        Route::get('/profile', [DriverController::class, 'profile'])->name('api.v1.driver.profile');
        Route::post('/profile/request-changes', [DriverProfileController::class, 'requestChanges'])->name('api.v1.driver.profile.request-changes');
        Route::get('/profile/change-requests', [DriverProfileController::class, 'changeRequests'])->name('api.v1.driver.profile.change-requests');
        Route::get('/stats', [DriverController::class, 'stats'])->name('api.v1.driver.stats');
        Route::get('/orders/active', [DriverController::class, 'activeOrder'])->name('api.v1.driver.orders.active');
        Route::get('/orders', [DriverController::class, 'orders'])->name('api.v1.driver.orders.index');
        Route::post('/orders/{order}/accept', [DriverController::class, 'acceptOrder'])->name('api.v1.driver.orders.accept');
        Route::post('/orders/{order}/decline', [DriverController::class, 'declineOrder'])->name('api.v1.driver.orders.decline');
        Route::post('/orders/{order}/arrived', [DriverController::class, 'arrived'])->name('api.v1.driver.orders.arrived');
        Route::post('/orders/{order}/start', [DriverController::class, 'startRide'])->name('api.v1.driver.orders.start');
        Route::post('/orders/{order}/complete', [DriverController::class, 'completeOrder'])->name('api.v1.driver.orders.complete');
    });
});
