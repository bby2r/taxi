<?php

namespace App\Providers;

use App\Models\DriverChangeRequest;
use App\Models\User;
use App\Services\NikitaSmsChannel;
use App\Services\OtpDispatcher;
use App\Services\WhatsAppCloudApiChannel;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(WhatsAppCloudApiChannel::class, fn () => new WhatsAppCloudApiChannel(
            accessToken: (string) config('whatsapp.access_token', ''),
            phoneNumberId: (string) config('whatsapp.phone_number_id', ''),
            templateName: (string) config('whatsapp.template_name', 'otp_login'),
            languageCode: (string) config('whatsapp.language_code', 'ru'),
            apiVersion: (string) config('whatsapp.api_version', 'v21.0'),
            enabled: (bool) config('whatsapp.enabled', false),
        ));

        $this->app->singleton(NikitaSmsChannel::class, fn () => new NikitaSmsChannel(
            login: (string) config('nikita.login', ''),
            password: (string) config('nikita.password', ''),
            sender: (string) config('nikita.sender', 'SMSPRO.KG'),
            messageTemplate: (string) config('nikita.message_template'),
            apiUrl: (string) config('nikita.api_url'),
            enabled: (bool) config('nikita.enabled', false),
        ));

        $this->app->singleton(OtpDispatcher::class, fn ($app) => new OtpDispatcher(
            primary: $app->make(WhatsAppCloudApiChannel::class),
            fallback: $app->make(NikitaSmsChannel::class),
        ));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Route::model('ticket', DriverChangeRequest::class);

        Gate::define('viewLogViewer', fn (?User $user) => $user?->isAdmin() ?? false);

        // Phone-keyed throttle for OTP sends. Stops SMS-pumping fraud where an
        // attacker rotates source IPs to drain the balance against one number.
        RateLimiter::for('otp-phone', fn (Request $request) => Limit::perHour(3)
            ->by((string) $request->input('phone')));
    }
}
