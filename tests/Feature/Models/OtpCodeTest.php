<?php

namespace Tests\Feature\Models;

use App\Models\OtpCode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OtpCodeTest extends TestCase
{
    use RefreshDatabase;

    public function test_otp_code_is_expired(): void
    {
        $otp = OtpCode::factory()->expired()->create();

        $this->assertTrue($otp->isExpired());
    }

    public function test_otp_code_is_not_expired(): void
    {
        $otp = OtpCode::factory()->create();

        $this->assertFalse($otp->isExpired());
    }

    public function test_otp_code_is_verified(): void
    {
        $otp = OtpCode::factory()->verified()->create();

        $this->assertTrue($otp->isVerified());
    }

    public function test_otp_code_is_valid(): void
    {
        $otp = OtpCode::factory()->create();

        $this->assertTrue($otp->isValid());
    }

    public function test_otp_code_is_invalid_when_expired(): void
    {
        $otp = OtpCode::factory()->expired()->create();

        $this->assertFalse($otp->isValid());
    }

    public function test_otp_code_is_invalid_when_verified(): void
    {
        $otp = OtpCode::factory()->verified()->create();

        $this->assertFalse($otp->isValid());
    }

    public function test_valid_scope(): void
    {
        OtpCode::factory()->create();
        OtpCode::factory()->expired()->create();
        OtpCode::factory()->verified()->create();

        $this->assertSame(1, OtpCode::valid()->count());
    }

    public function test_for_phone_scope(): void
    {
        $phoneA = '+996555111222';
        $phoneB = '+996555333444';

        OtpCode::factory()->count(2)->create(['phone' => $phoneA]);
        OtpCode::factory()->create(['phone' => $phoneB]);

        $this->assertSame(2, OtpCode::forPhone($phoneA)->count());
    }
}
