<?php

namespace App\Providers;

use App\Services\NikitaSmsService;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(NikitaSmsService::class, fn ($app) => new NikitaSmsService(
            login: config('nikita.login', ''),
            password: config('nikita.password', ''),
            sender: config('nikita.sender', 'Taxi'),
            enabled: (bool) config('nikita.enabled', false),
        ));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
