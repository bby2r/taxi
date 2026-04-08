<?php

namespace Tests\Feature\Models;

use App\Enums\DriverChangeRequestStatus;
use App\Models\DriverChangeRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class DriverChangeRequestTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_create_via_factory(): void
    {
        $request = DriverChangeRequest::factory()->create();

        $this->assertDatabaseHas('driver_change_requests', [
            'id' => $request->id,
            'status' => 'pending',
        ]);
    }

    public function test_user_relationship(): void
    {
        $request = DriverChangeRequest::factory()->create();

        $this->assertInstanceOf(User::class, $request->user);
    }

    public function test_reviewer_relationship(): void
    {
        $request = DriverChangeRequest::factory()->approved()->create();

        $this->assertInstanceOf(User::class, $request->reviewer);
        $this->assertTrue($request->reviewer->isAdmin());
    }

    public function test_reviewer_is_null_when_pending(): void
    {
        $request = DriverChangeRequest::factory()->create();

        $this->assertNull($request->reviewer);
    }

    public function test_status_is_cast_to_enum(): void
    {
        $request = DriverChangeRequest::factory()->create();

        $this->assertInstanceOf(DriverChangeRequestStatus::class, $request->status);
    }

    public function test_reviewed_at_is_cast_to_datetime(): void
    {
        $request = DriverChangeRequest::factory()->approved()->create();

        $this->assertInstanceOf(Carbon::class, $request->reviewed_at);
    }

    public function test_pending_scope(): void
    {
        DriverChangeRequest::factory()->count(2)->create();
        DriverChangeRequest::factory()->approved()->create();

        $this->assertSame(2, DriverChangeRequest::pending()->count());
    }

    public function test_for_user_scope(): void
    {
        $user = User::factory()->driver()->create();
        DriverChangeRequest::factory()->count(2)->for($user)->create();
        DriverChangeRequest::factory()->create(); // different user

        $this->assertSame(2, DriverChangeRequest::forUser($user->id)->count());
    }

    public function test_for_field_scope(): void
    {
        DriverChangeRequest::factory()->forField('car_number')->count(2)->create();
        DriverChangeRequest::factory()->forField('car_model')->create();

        $this->assertSame(2, DriverChangeRequest::forField('car_number')->count());
    }

    public function test_approved_factory_state(): void
    {
        $request = DriverChangeRequest::factory()->approved()->create();

        $this->assertSame(DriverChangeRequestStatus::Approved, $request->status);
        $this->assertNotNull($request->reviewed_at);
        $this->assertNotNull($request->reviewed_by);
    }

    public function test_rejected_factory_state(): void
    {
        $request = DriverChangeRequest::factory()->rejected()->create();

        $this->assertSame(DriverChangeRequestStatus::Rejected, $request->status);
        $this->assertNotNull($request->admin_comment);
    }

    public function test_for_field_factory_state(): void
    {
        $request = DriverChangeRequest::factory()->forField('car_number')->create();

        $this->assertSame('car_number', $request->field);
    }

    public function test_user_change_requests_relationship(): void
    {
        $user = User::factory()->driver()->create();
        DriverChangeRequest::factory()->count(2)->for($user)->create();

        $this->assertSame(2, $user->changeRequests()->count());
    }
}
