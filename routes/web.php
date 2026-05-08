<?php

use App\Enums\UserRole;
use App\Http\Controllers\Admin\AuthController;
use App\Http\Controllers\Admin\BillingController;
use App\Http\Controllers\Admin\ClientController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\DriverController;
use App\Http\Controllers\Admin\DriverTicketController;
use App\Http\Controllers\Admin\OrderController;
use App\Http\Controllers\Admin\RegionController;
use App\Http\Controllers\Admin\SettingController;
use App\Http\Middleware\EnsureUserRole;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    if (auth()->check() && auth()->user()->role === UserRole::Admin) {
        return redirect()->route('admin.dashboard');
    }

    return view('landing');
})->name('home');

Route::get('login', function (Request $request) {
    return redirect()->route('admin.login');
})->name('login');

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

        Route::get('clients', [ClientController::class, 'index'])->name('clients.index');

        Route::resource('regions', RegionController::class)->except(['show']);

        Route::resource('orders', OrderController::class)->only(['index', 'show']);

        Route::resource('tickets', DriverTicketController::class)->only(['index', 'show']);
        Route::post('tickets/{ticket}/approve', [DriverTicketController::class, 'approve'])->name('tickets.approve');
        Route::post('tickets/{ticket}/reject', [DriverTicketController::class, 'reject'])->name('tickets.reject');

        Route::get('billing', [BillingController::class, 'index'])->name('billing.index');
        Route::get('billing/{driver}', [BillingController::class, 'show'])->name('billing.show');
        Route::post('billing/{driver}/settlements', [BillingController::class, 'storeSettlement'])->name('billing.settlements.store');

        Route::get('settings', [SettingController::class, 'index'])->name('settings.index');
        Route::put('settings', [SettingController::class, 'update'])->name('settings.update');
    });
});
