<?php

use App\Http\Controllers\Admin\AuthController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\DriverController;
use App\Http\Middleware\EnsureUserRole;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::prefix('admin')->name('admin.')->group(function () {
    Route::middleware('guest')->group(function () {
        Route::get('login', [AuthController::class, 'showLogin'])->name('login');
        Route::post('login', [AuthController::class, 'login'])->name('login.submit');
    });

    Route::middleware(['auth', EnsureUserRole::class.':admin'])->group(function () {
        Route::post('logout', [AuthController::class, 'logout'])->name('logout');
        Route::get('/', fn () => redirect()->route('admin.dashboard'));
        Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

        Route::resource('drivers', DriverController::class)->except(['show']);

        // Placeholder routes — full controllers added in later steps
        Route::get('orders', fn () => '')->name('orders.index');
    });
});
