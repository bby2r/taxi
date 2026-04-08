<?php

namespace App\Providers;

use App\Models\DriverChangeRequest;
use App\Services\NikitaSmsService;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(NikitaSmsService::class, fn ($app) => new NikitaSmsService(
            login: (string) config('nikita.login', ''),
            password: (string) config('nikita.password', ''),
            sender: (string) config('nikita.sender', 'Taxi'),
            enabled: (bool) config('nikita.enabled', false),
        ));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Route::model('ticket', DriverChangeRequest::class);
    }
}
