<?php

namespace Tests\Feature\Services;

use App\Models\OtpCode;
use App\Services\NikitaSmsService;
use App\Services\OtpService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class OtpServiceTest extends TestCase
{
    use RefreshDatabase;

    protected OtpService $otpService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->mock(NikitaSmsService::class)
            ->shouldReceive('send')
            ->andReturn(true);

        $this->otpService = app(OtpService::class);
    }

    #[Test]
    public function test_send_otp_creates_otp_code(): void
    {
        $otp = $this->otpService->sendOtp('+996700123456');

        $this->assertSame(1, OtpCode::count());
        $this->assertMatchesRegularExpression('/^\d{4}$/', $otp->code);
    }

    #[Test]
    public function test_send_otp_invalidates_previous_otps(): void
    {
        $phone = '+996700123456';

        $this->otpService->sendOtp($phone);
        $this->otpService->sendOtp($phone);

        $this->assertSame(1, OtpCode::valid()->forPhone($phone)->count());
    }

    #[Test]
    public function test_verify_otp_returns_otp_code_on_success(): void
    {
        $phone = '+996700123456';
        $otp = $this->otpService->sendOtp($phone);

        $result = $this->otpService->verifyOtp($phone, $otp->code);

        $this->assertNotNull($result);
        $this->assertInstanceOf(OtpCode::class, $result);
        $this->assertNotNull($result->verified_at);
    }

    #[Test]
    public function test_verify_otp_returns_null_on_wrong_code(): void
    {
        $phone = '+996700123456';
        $otp = $this->otpService->sendOtp($phone);

        // Use a code guaranteed to be different from the real one
        $wrongCode = $otp->code === '0000' ? '1111' : '0000';

        $result = $this->otpService->verifyOtp($phone, $wrongCode);

        $this->assertNull($result);
    }

    #[Test]
    public function test_verify_otp_returns_null_on_expired_code(): void
    {
        $phone = '+996700123456';
        $otp = OtpCode::factory()->expired()->create(['phone' => $phone]);

        $result = $this->otpService->verifyOtp($phone, $otp->code);

        $this->assertNull($result);
    }

    #[Test]
    public function test_verify_otp_returns_null_on_already_verified_code(): void
    {
        $phone = '+996700123456';
        $otp = $this->otpService->sendOtp($phone);

        $this->otpService->verifyOtp($phone, $otp->code);
        $result = $this->otpService->verifyOtp($phone, $otp->code);

        $this->assertNull($result);
    }

    #[Test]
    public function test_otp_code_is_four_digits_with_leading_zeros(): void
    {
        $phone = '+996700123456';

        for ($i = 0; $i < 10; $i++) {
            $otp = $this->otpService->sendOtp($phone);
            $this->assertMatchesRegularExpression('/^\d{4}$/', $otp->code);
        }
    }
}
