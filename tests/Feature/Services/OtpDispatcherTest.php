<?php

namespace Tests\Feature\Services;

use App\Contracts\OtpChannel;
use App\Services\OtpDispatcher;
use Mockery;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class OtpDispatcherTest extends TestCase
{
    #[Test]
    public function test_returns_true_when_primary_succeeds_and_skips_fallback(): void
    {
        $primary = Mockery::mock(OtpChannel::class);
        $fallback = Mockery::mock(OtpChannel::class);

        $primary->shouldReceive('send')->once()->andReturn(true);
        $fallback->shouldNotReceive('send');

        $dispatcher = new OtpDispatcher($primary, $fallback);

        $this->assertTrue($dispatcher->send('+996700123456', '1234'));
    }

    #[Test]
    public function test_calls_fallback_when_primary_fails(): void
    {
        $primary = Mockery::mock(OtpChannel::class);
        $fallback = Mockery::mock(OtpChannel::class);

        $primary->shouldReceive('send')->once()->andReturn(false);
        $fallback->shouldReceive('send')->once()->andReturn(true);

        $dispatcher = new OtpDispatcher($primary, $fallback);

        $this->assertTrue($dispatcher->send('+996700123456', '1234'));
    }

    #[Test]
    public function test_returns_false_when_both_channels_fail(): void
    {
        $primary = Mockery::mock(OtpChannel::class);
        $fallback = Mockery::mock(OtpChannel::class);

        $primary->shouldReceive('send')->once()->andReturn(false);
        $fallback->shouldReceive('send')->once()->andReturn(false);

        $dispatcher = new OtpDispatcher($primary, $fallback);

        $this->assertFalse($dispatcher->send('+996700123456', '1234'));
    }
}
