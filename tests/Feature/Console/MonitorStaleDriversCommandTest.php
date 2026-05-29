<?php

namespace Tests\Feature\Console;

use App\Models\DriverProfile;
use App\Models\Setting;
use App\Models\User;
use App\Services\ExpoPushService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class MonitorStaleDriversCommandTest extends TestCase
{
    use RefreshDatabase;

    private function setHeartbeat(int $seconds): void
    {
        Setting::updateOrCreate(
            ['key' => 'live_heartbeat_seconds'],
            ['value' => (string) $seconds, 'description' => 'test'],
        );
    }

    private function onlineDriver(string $lastPing, ?string $silentAt = null, ?string $nudgeAt = null): DriverProfile
    {
        $user = User::factory()->create(['expo_push_token' => 'ExponentPushToken[test]']);

        return DriverProfile::factory()->online()->create([
            'user_id' => $user->id,
            'location_updated_at' => $lastPing,
            'stale_silent_pinged_at' => $silentAt,
            'stale_nudge_sent_at' => $nudgeAt,
        ]);
    }

    public function test_fires_silent_push_once_heartbeat_passes(): void
    {
        $this->setHeartbeat(60);
        $profile = $this->onlineDriver(now()->subSeconds(90)->toDateTimeString());

        $this->mock(ExpoPushService::class, function (MockInterface $mock) {
            $mock->shouldReceive('sendSilentWakeToDriver')->once()->andReturnTrue();
            $mock->shouldReceive('sendStaleNudgeToDriver')->never();
        });

        $this->artisan('drivers:monitor-stale')->assertExitCode(0);

        $profile->refresh();
        $this->assertNotNull($profile->stale_silent_pinged_at);
        $this->assertTrue($profile->is_online);
    }

    public function test_fires_visible_nudge_after_silent_and_extra_120s(): void
    {
        $this->setHeartbeat(60);
        $profile = $this->onlineDriver(
            now()->subSeconds(200)->toDateTimeString(),
            silentAt: now()->subSeconds(140)->toDateTimeString(),
        );

        $this->mock(ExpoPushService::class, function (MockInterface $mock) {
            $mock->shouldReceive('sendStaleNudgeToDriver')->once()->andReturnTrue();
            $mock->shouldReceive('sendSilentWakeToDriver')->never();
        });

        $this->artisan('drivers:monitor-stale')->assertExitCode(0);

        $profile->refresh();
        $this->assertNotNull($profile->stale_nudge_sent_at);
        $this->assertTrue($profile->is_online);
    }

    public function test_auto_offline_scales_with_heartbeat_when_above_floor(): void
    {
        // H = 300s → offline cutoff = max(900, 600) = 900s. 901s stale flips offline.
        $this->setHeartbeat(300);
        $profile = $this->onlineDriver(
            now()->subSeconds(901)->toDateTimeString(),
            silentAt: now()->subSeconds(700)->toDateTimeString(),
            nudgeAt: now()->subSeconds(500)->toDateTimeString(),
        );

        $this->mock(ExpoPushService::class, function (MockInterface $mock) {
            $mock->shouldReceive('sendSilentWakeToDriver')->never();
            $mock->shouldReceive('sendStaleNudgeToDriver')->never();
        });

        $this->artisan('drivers:monitor-stale')->assertExitCode(0);

        $profile->refresh();
        $this->assertFalse($profile->is_online);
        $this->assertNull($profile->stale_silent_pinged_at);
        $this->assertNull($profile->stale_nudge_sent_at);
    }

    public function test_auto_offline_respects_10_minute_floor_for_short_heartbeats(): void
    {
        // H = 60s. H*3 = 180s but floor is 600s. 540s stale must NOT auto-offline yet.
        $this->setHeartbeat(60);
        $profile = $this->onlineDriver(
            now()->subSeconds(540)->toDateTimeString(),
            silentAt: now()->subSeconds(480)->toDateTimeString(),
            nudgeAt: now()->subSeconds(360)->toDateTimeString(),
        );

        $this->mock(ExpoPushService::class);

        $this->artisan('drivers:monitor-stale')->assertExitCode(0);

        $profile->refresh();
        $this->assertTrue($profile->is_online);
    }

    public function test_auto_offline_triggers_at_floor_for_short_heartbeats(): void
    {
        // H = 60s, floor = 600s. 601s stale → offline.
        $this->setHeartbeat(60);
        $profile = $this->onlineDriver(
            now()->subSeconds(601)->toDateTimeString(),
            silentAt: now()->subSeconds(540)->toDateTimeString(),
            nudgeAt: now()->subSeconds(420)->toDateTimeString(),
        );

        $this->mock(ExpoPushService::class);

        $this->artisan('drivers:monitor-stale')->assertExitCode(0);

        $profile->refresh();
        $this->assertFalse($profile->is_online);
    }

    public function test_leaves_fresh_online_driver_alone(): void
    {
        $this->setHeartbeat(60);
        $profile = $this->onlineDriver(now()->subSeconds(20)->toDateTimeString());

        $this->mock(ExpoPushService::class, function (MockInterface $mock) {
            $mock->shouldReceive('sendSilentWakeToDriver')->never();
            $mock->shouldReceive('sendStaleNudgeToDriver')->never();
        });

        $this->artisan('drivers:monitor-stale')->assertExitCode(0);

        $profile->refresh();
        $this->assertTrue($profile->is_online);
        $this->assertNull($profile->stale_silent_pinged_at);
    }
}
