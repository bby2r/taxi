<?php

namespace Tests\Unit\Services;

use App\Services\NoOpSmsChannel;
use Illuminate\Support\Facades\Log;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class NoOpSmsChannelTest extends TestCase
{
    #[Test]
    public function test_send_returns_false(): void
    {
        Log::spy();

        $result = (new NoOpSmsChannel)->send('+996700123456', '1234');

        $this->assertFalse($result);
    }

    #[Test]
    public function test_send_logs_warning_in_production(): void
    {
        Log::spy();
        $this->app->detectEnvironment(fn () => 'production');

        (new NoOpSmsChannel)->send('+996700123456', '1234');

        Log::shouldHaveReceived('warning')
            ->withArgs(fn ($message, $context) => $message === 'SMS fallback invoked but no SMS provider is configured.'
                && $context['phone'] === '+996700123456'
            )
            ->once();
    }
}
