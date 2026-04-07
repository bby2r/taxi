<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\ExpoPushService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ExpoPushServiceTest extends TestCase
{
    use RefreshDatabase;

    private ExpoPushService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new ExpoPushService;
    }

    public function test_send_to_user_with_valid_token(): void
    {
        $user = User::factory()->create(['expo_push_token' => 'ExponentPushToken[test-token-123]']);

        Http::fake([
            'https://exp.host/*' => Http::response(['data' => [['status' => 'ok']]]),
        ]);

        $result = $this->service->sendToUser($user, 'Test Title', 'Test Body', ['key' => 'value']);

        $this->assertTrue($result);

        Http::assertSent(function ($request) {
            $payload = $request->data()[0];

            return $payload['to'] === 'ExponentPushToken[test-token-123]'
                && $payload['title'] === 'Test Title'
                && $payload['body'] === 'Test Body'
                && $payload['data']['key'] === 'value'
                && $payload['sound'] === 'default';
        });
    }

    public function test_send_to_user_with_null_token_returns_false(): void
    {
        $user = User::factory()->create(['expo_push_token' => null]);

        Http::fake();

        $result = $this->service->sendToUser($user, 'Title', 'Body');

        $this->assertFalse($result);

        Http::assertNothingSent();
    }

    public function test_send_to_user_with_empty_token_returns_false(): void
    {
        $user = User::factory()->create(['expo_push_token' => '']);

        Http::fake();

        $result = $this->service->sendToUser($user, 'Title', 'Body');

        $this->assertFalse($result);

        Http::assertNothingSent();
    }

    public function test_send_to_user_handles_http_failure(): void
    {
        $user = User::factory()->create(['expo_push_token' => 'ExponentPushToken[test-token-456]']);

        Http::fake(['*' => Http::response('Server Error', 500)]);

        $result = $this->service->sendToUser($user, 'Title', 'Body');

        $this->assertFalse($result);
    }

    public function test_send_to_user_handles_expo_error(): void
    {
        $user = User::factory()->create(['expo_push_token' => 'ExponentPushToken[test-token-789]']);

        Http::fake([
            '*' => Http::response(['data' => [['status' => 'error', 'message' => 'DeviceNotRegistered']]]),
        ]);

        $result = $this->service->sendToUser($user, 'Title', 'Body');

        $this->assertFalse($result);
    }

    public function test_send_to_users_skips_users_without_tokens(): void
    {
        User::factory()->create(['expo_push_token' => 'ExponentPushToken[token-1]']);
        User::factory()->create(['expo_push_token' => 'ExponentPushToken[token-2]']);
        User::factory()->create(['expo_push_token' => null]);

        Http::fake([
            '*' => Http::response(['data' => [['status' => 'ok'], ['status' => 'ok']]]),
        ]);

        $count = $this->service->sendToUsers(User::all(), 'Title', 'Body');

        $this->assertEquals(2, $count);

        Http::assertSent(function ($request) {
            return count($request->data()) === 2;
        });
    }

    public function test_send_to_users_returns_zero_when_no_tokens(): void
    {
        User::factory()->count(2)->create(['expo_push_token' => null]);

        Http::fake();

        $count = $this->service->sendToUsers(User::all(), 'Title', 'Body');

        $this->assertEquals(0, $count);

        Http::assertNothingSent();
    }

    public function test_send_includes_sound_default(): void
    {
        $user = User::factory()->create(['expo_push_token' => 'ExponentPushToken[token-sound]']);

        Http::fake(['*' => Http::response(['data' => [['status' => 'ok']]])]);

        $this->service->sendToUser($user, 'T', 'B');

        Http::assertSent(fn ($r) => $r->data()[0]['sound'] === 'default');
    }
}
