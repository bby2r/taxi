<?php

namespace Tests\Feature\Http\Auth;

use App\Models\OtpCode;
use App\Services\OtpDispatcher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SendOtpTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->mock(OtpDispatcher::class)
            ->shouldReceive('send')
            ->andReturn(true);
    }

    #[Test]
    public function test_send_otp_with_valid_phone(): void
    {
        $response = $this->postJson('/api/v1/auth/send-otp', [
            'phone' => '+996700123456',
        ]);

        $response->assertStatus(200)
            ->assertJson(['message' => 'OTP code sent successfully.']);

        $this->assertSame(1, OtpCode::count());
    }

    #[Test]
    public function test_send_otp_with_invalid_phone(): void
    {
        $response = $this->postJson('/api/v1/auth/send-otp', [
            'phone' => '123',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['phone']);
    }

    #[Test]
    public function test_send_otp_with_non_kyrgyz_phone(): void
    {
        $response = $this->postJson('/api/v1/auth/send-otp', [
            'phone' => '+1234567890',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['phone']);
    }

    #[Test]
    public function test_send_otp_with_missing_phone(): void
    {
        $response = $this->postJson('/api/v1/auth/send-otp', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['phone']);
    }

    #[Test]
    public function test_send_otp_phone_throttle_blocks_pumping(): void
    {
        // Phone-keyed limit is 3 per hour. 4th request to the same phone
        // must be rejected even if it comes from a different IP — this is
        // the core anti-SMS-pumping protection.
        for ($i = 0; $i < 3; $i++) {
            $response = $this->postJson('/api/v1/auth/send-otp', [
                'phone' => '+996700123456',
            ]);

            $response->assertStatus(200);
        }

        $response = $this->postJson('/api/v1/auth/send-otp', [
            'phone' => '+996700123456',
        ]);

        $response->assertStatus(429);
    }

    #[Test]
    public function test_send_otp_ip_throttle_blocks_phone_spraying(): void
    {
        // IP-keyed limit is 5 per minute. Sending to 5 distinct phones from
        // the same IP must succeed; the 6th distinct phone must be rejected.
        for ($i = 0; $i < 5; $i++) {
            $response = $this->postJson('/api/v1/auth/send-otp', [
                'phone' => "+99670012345{$i}",
            ]);

            $response->assertStatus(200);
        }

        $response = $this->postJson('/api/v1/auth/send-otp', [
            'phone' => '+996700123459',
        ]);

        $response->assertStatus(429);
    }
}
