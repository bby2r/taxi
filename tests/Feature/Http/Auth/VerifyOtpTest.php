<?php

namespace Tests\Feature\Http\Auth;

use App\Enums\UserRole;
use App\Models\OtpCode;
use App\Models\User;
use App\Services\NikitaSmsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class VerifyOtpTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->mock(NikitaSmsService::class)
            ->shouldReceive('send')
            ->andReturn(true);
    }

    /**
     * Helper to send an OTP via the API and return the created OtpCode.
     */
    private function sendOtp(string $phone): OtpCode
    {
        $this->postJson('/api/v1/auth/send-otp', ['phone' => $phone]);

        return OtpCode::where('phone', $phone)->latest('id')->first();
    }

    #[Test]
    public function test_verify_otp_creates_new_user(): void
    {
        $phone = '+996700123456';
        $otp = $this->sendOtp($phone);

        $response = $this->postJson('/api/v1/auth/verify-otp', [
            'phone' => $phone,
            'code' => $otp->code,
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure(['message', 'token', 'user']);

        $this->assertSame(1, User::count());
        $this->assertNotEmpty($response->json('token'));
    }

    #[Test]
    public function test_verify_otp_returns_existing_user(): void
    {
        $phone = '+996700123456';
        User::factory()->create(['phone' => $phone]);

        $otp = $this->sendOtp($phone);

        $response = $this->postJson('/api/v1/auth/verify-otp', [
            'phone' => $phone,
            'code' => $otp->code,
        ]);

        $response->assertStatus(200);
        $this->assertSame(1, User::count());
    }

    #[Test]
    public function test_verify_otp_with_wrong_code(): void
    {
        $phone = '+996700123456';
        $otp = $this->sendOtp($phone);

        $wrongCode = $otp->code === '0000' ? '1111' : '0000';

        $response = $this->postJson('/api/v1/auth/verify-otp', [
            'phone' => $phone,
            'code' => $wrongCode,
        ]);

        $response->assertStatus(422)
            ->assertJson(['message' => 'Invalid or expired OTP code.']);
    }

    #[Test]
    public function test_verify_otp_with_expired_code(): void
    {
        $phone = '+996700123456';
        $otp = OtpCode::factory()->expired()->create(['phone' => $phone]);

        $response = $this->postJson('/api/v1/auth/verify-otp', [
            'phone' => $phone,
            'code' => $otp->code,
        ]);

        $response->assertStatus(422)
            ->assertJson(['message' => 'Invalid or expired OTP code.']);
    }

    #[Test]
    public function test_verify_otp_sets_phone_verified_at(): void
    {
        $phone = '+996700123456';
        $otp = $this->sendOtp($phone);

        $this->postJson('/api/v1/auth/verify-otp', [
            'phone' => $phone,
            'code' => $otp->code,
        ]);

        $user = User::where('phone', $phone)->first();

        $this->assertNotNull($user);
        $this->assertNotNull($user->phone_verified_at);
    }

    #[Test]
    public function test_verify_otp_revokes_existing_tokens(): void
    {
        $phone = '+996700123456';

        // First login
        $otp1 = $this->sendOtp($phone);
        $response1 = $this->postJson('/api/v1/auth/verify-otp', [
            'phone' => $phone,
            'code' => $otp1->code,
        ]);
        $token1 = $response1->json('token');

        $user = User::where('phone', $phone)->first();
        $this->assertSame(1, $user->tokens()->count());

        // Second login
        $otp2 = $this->sendOtp($phone);
        $response2 = $this->postJson('/api/v1/auth/verify-otp', [
            'phone' => $phone,
            'code' => $otp2->code,
        ]);
        $response2->assertStatus(200);
        $token2 = $response2->json('token');

        // User should have exactly 1 token (old one revoked, new one created)
        $user->refresh();
        $this->assertSame(1, $user->tokens()->count());

        // The new token should be different from the old one
        $this->assertNotSame($token1, $token2);
    }

    #[Test]
    public function test_verify_otp_response_structure(): void
    {
        $phone = '+996700123456';
        $otp = $this->sendOtp($phone);

        $response = $this->postJson('/api/v1/auth/verify-otp', [
            'phone' => $phone,
            'code' => $otp->code,
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'token',
                'user' => [
                    'id',
                    'name',
                    'phone',
                    'role',
                ],
            ]);

        $this->assertSame('Authenticated successfully.', $response->json('message'));
        $this->assertSame($phone, $response->json('user.phone'));
        $this->assertSame(UserRole::Client->value, $response->json('user.role'));
    }
}
