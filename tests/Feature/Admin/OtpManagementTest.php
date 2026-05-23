<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\OtpCode;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OtpManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create();
    }

    public function test_otp_index_page_loads_successfully(): void
    {
        $response = $this->actingAs($this->admin)->get(route('admin.otps.index'));

        $response->assertOk();
        $response->assertSee('Коды OTP');
    }

    public function test_otp_index_shows_recent_codes(): void
    {
        $otp = OtpCode::factory()->create([
            'phone' => '+996700111222',
            'code' => '1234',
        ]);

        $response = $this->actingAs($this->admin)->get(route('admin.otps.index'));

        $response->assertOk();
        $response->assertSee($otp->phone);
        $response->assertSee($otp->code);
    }

    public function test_otp_index_hides_codes_older_than_24_hours(): void
    {
        OtpCode::factory()->create([
            'phone' => '+996700999888',
            'code' => '5678',
            'created_at' => now()->subDays(2),
        ]);

        $response = $this->actingAs($this->admin)->get(route('admin.otps.index'));

        $response->assertOk();
        $response->assertDontSee('+996700999888');
        $response->assertDontSee('5678');
    }

    public function test_otp_index_filters_by_phone(): void
    {
        OtpCode::factory()->create(['phone' => '+996700111222', 'code' => '1111']);
        OtpCode::factory()->create(['phone' => '+996555444333', 'code' => '2222']);

        $response = $this->actingAs($this->admin)->get(route('admin.otps.index', ['phone' => '700']));

        $response->assertOk();
        $response->assertSee('+996700111222');
        $response->assertDontSee('+996555444333');
    }

    public function test_otp_index_renders_status_for_active_expired_and_verified_codes(): void
    {
        OtpCode::factory()->create(['phone' => '+996700000001', 'code' => '1111']);
        OtpCode::factory()->expired()->create(['phone' => '+996700000002', 'code' => '2222']);
        OtpCode::factory()->verified()->create(['phone' => '+996700000003', 'code' => '3333']);

        $response = $this->actingAs($this->admin)->get(route('admin.otps.index'));

        $response->assertOk();
        $response->assertSee('Активен');
        $response->assertSee('Истёк');
        $response->assertSee('Использован');
    }

    public function test_non_admin_cannot_access_otp_index(): void
    {
        $client = User::factory()->create(['role' => UserRole::Client]);

        $response = $this->actingAs($client)->get(route('admin.otps.index'));

        $response->assertRedirect();
    }

    public function test_guest_cannot_access_otp_index(): void
    {
        $response = $this->get(route('admin.otps.index'));

        $this->assertNotEquals(200, $response->getStatusCode());
    }
}
