<?php

namespace Tests\Feature\Http\Auth;

use App\Models\OtpCode;
use App\Services\NikitaSmsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SendOtpTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->mock(NikitaSmsService::class)
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
    public function test_send_otp_rate_limit(): void
    {
        for ($i = 0; $i < 5; $i++) {
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
}
