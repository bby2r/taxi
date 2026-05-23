<?php

namespace Tests\Feature\Http\Auth;

use App\Models\OtpCode;
use App\Models\User;
use App\Services\OtpDispatcher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ChangePhoneTest extends TestCase
{
    use RefreshDatabase;

    private string $sendOtpUrl = '/api/v1/auth/change-phone/send-otp';

    private string $verifyUrl = '/api/v1/auth/change-phone/verify';

    protected function setUp(): void
    {
        parent::setUp();

        $this->mock(OtpDispatcher::class)
            ->shouldReceive('send')
            ->andReturn(true);
    }

    #[Test]
    public function test_send_otp_to_new_phone(): void
    {
        $user = User::factory()->create(['phone' => '+996700000001']);
        Sanctum::actingAs($user);

        $response = $this->postJson($this->sendOtpUrl, [
            'phone' => '+996700000002',
        ]);

        $response->assertStatus(200)
            ->assertJson(['message' => 'OTP code sent to new phone number.']);

        $this->assertDatabaseHas('otp_codes', [
            'phone' => '+996700000002',
        ]);
    }

    #[Test]
    public function test_send_otp_rejects_current_phone(): void
    {
        $user = User::factory()->create(['phone' => '+996700000001']);
        Sanctum::actingAs($user);

        $response = $this->postJson($this->sendOtpUrl, [
            'phone' => '+996700000001',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['phone']);
    }

    #[Test]
    public function test_send_otp_rejects_already_taken_phone(): void
    {
        User::factory()->create(['phone' => '+996700000002']);
        $user = User::factory()->create(['phone' => '+996700000001']);
        Sanctum::actingAs($user);

        $response = $this->postJson($this->sendOtpUrl, [
            'phone' => '+996700000002',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['phone']);
    }

    #[Test]
    public function test_send_otp_rejects_invalid_phone_format(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->postJson($this->sendOtpUrl, [
            'phone' => '123456',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['phone']);
    }

    #[Test]
    public function test_verify_otp_updates_phone(): void
    {
        $user = User::factory()->create(['phone' => '+996700000001']);
        Sanctum::actingAs($user);

        $newPhone = '+996700000002';

        $this->postJson($this->sendOtpUrl, ['phone' => $newPhone])
            ->assertStatus(200);

        $otpCode = OtpCode::where('phone', $newPhone)->latest()->first();

        $response = $this->postJson($this->verifyUrl, [
            'phone' => $newPhone,
            'code' => $otpCode->code,
        ]);

        $response->assertStatus(200)
            ->assertJson(['message' => 'Phone number updated successfully.']);

        $user->refresh();
        $this->assertSame($newPhone, $user->phone);
        $this->assertNotNull($user->phone_verified_at);
    }

    #[Test]
    public function test_verify_otp_fails_with_wrong_code(): void
    {
        $user = User::factory()->create(['phone' => '+996700000001']);
        Sanctum::actingAs($user);

        $newPhone = '+996700000002';

        $this->postJson($this->sendOtpUrl, ['phone' => $newPhone])
            ->assertStatus(200);

        $response = $this->postJson($this->verifyUrl, [
            'phone' => $newPhone,
            'code' => '0000',
        ]);

        $response->assertStatus(422);

        $user->refresh();
        $this->assertSame('+996700000001', $user->phone);
    }

    #[Test]
    public function test_verify_otp_fails_with_expired_code(): void
    {
        $user = User::factory()->create(['phone' => '+996700000001']);
        Sanctum::actingAs($user);

        $newPhone = '+996700000002';

        $otpCode = OtpCode::factory()->expired()->create([
            'phone' => $newPhone,
            'code' => '1234',
        ]);

        $response = $this->postJson($this->verifyUrl, [
            'phone' => $newPhone,
            'code' => '1234',
        ]);

        $response->assertStatus(422);

        $user->refresh();
        $this->assertSame('+996700000001', $user->phone);
    }

    #[Test]
    public function test_verify_otp_rejects_phone_taken_race_condition(): void
    {
        $user = User::factory()->create(['phone' => '+996700000001']);
        Sanctum::actingAs($user);

        $newPhone = '+996700000002';

        $this->postJson($this->sendOtpUrl, ['phone' => $newPhone])
            ->assertStatus(200);

        $otpCode = OtpCode::where('phone', $newPhone)->latest()->first();

        // Another user takes the phone between OTP send and verify
        User::factory()->create(['phone' => $newPhone]);

        $response = $this->postJson($this->verifyUrl, [
            'phone' => $newPhone,
            'code' => $otpCode->code,
        ]);

        $response->assertStatus(409)
            ->assertJson(['message' => 'This phone number was just taken.']);

        $user->refresh();
        $this->assertSame('+996700000001', $user->phone);
    }

    #[Test]
    public function test_unauthenticated_user_cannot_change_phone(): void
    {
        $response = $this->postJson($this->sendOtpUrl, [
            'phone' => '+996700000002',
        ]);

        $response->assertStatus(401);

        $response = $this->postJson($this->verifyUrl, [
            'phone' => '+996700000002',
            'code' => '1234',
        ]);

        $response->assertStatus(401);
    }

    #[Test]
    public function test_client_can_change_phone(): void
    {
        $user = User::factory()->create(['phone' => '+996700000001']);
        Sanctum::actingAs($user);

        $newPhone = '+996700000099';

        $this->postJson($this->sendOtpUrl, ['phone' => $newPhone])
            ->assertStatus(200);

        $otpCode = OtpCode::where('phone', $newPhone)->latest()->first();

        $this->postJson($this->verifyUrl, [
            'phone' => $newPhone,
            'code' => $otpCode->code,
        ])->assertStatus(200);

        $user->refresh();
        $this->assertSame($newPhone, $user->phone);
        $this->assertNotNull($user->phone_verified_at);
    }

    #[Test]
    public function test_driver_can_change_phone(): void
    {
        $user = User::factory()->driver()->create(['phone' => '+996700000010']);
        Sanctum::actingAs($user);

        $newPhone = '+996700000020';

        $this->postJson($this->sendOtpUrl, ['phone' => $newPhone])
            ->assertStatus(200);

        $otpCode = OtpCode::where('phone', $newPhone)->latest()->first();

        $this->postJson($this->verifyUrl, [
            'phone' => $newPhone,
            'code' => $otpCode->code,
        ])->assertStatus(200);

        $user->refresh();
        $this->assertSame($newPhone, $user->phone);
        $this->assertNotNull($user->phone_verified_at);
    }
}
