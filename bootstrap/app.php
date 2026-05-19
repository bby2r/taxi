<?php

use App\Enums\UserRole;
use App\Http\Middleware\EnsureUserRole;
use App\Http\Middleware\LogApiTraffic;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\HandleCors;
use Illuminate\Http\Request;
use Sentry\Laravel\Integration;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(at: '*');

        $middleware->redirectUsersTo(fn (Request $request) => route(
            $request->user()?->role === UserRole::Admin ? 'admin.dashboard' : 'home'
        ));

        $middleware->alias([
            'role' => EnsureUserRole::class,
        ]);

        $middleware->api(prepend: [
            HandleCors::class,
            LogApiTraffic::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Forward unhandled exceptions to Sentry — silently no-ops if
        // SENTRY_LARAVEL_DSN is not set, so local dev / tests behave
        // exactly as before. On prod set the DSN env var to start
        // collecting errors.
        Integration::handles($exceptions);
    })->create();
