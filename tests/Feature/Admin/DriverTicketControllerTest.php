<?php

namespace Tests\Feature\Admin;

use App\Enums\DriverChangeRequestStatus;
use App\Models\DriverChangeRequest;
use App\Models\DriverProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DriverTicketControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create();
    }

    /**
     * Create a driver with profile and a pending ticket for the given field.
     *
     * @param  array<string, mixed>  $ticketOverrides
     */
    private function createTicketForDriver(
        string $field = 'car_model',
        string $oldValue = 'Old Value',
        string $newValue = 'New Value',
        array $ticketOverrides = [],
    ): array {
        $driver = User::factory()->driver()->create(['name' => 'Test Driver']);
        DriverProfile::factory()->for($driver)->create([
            'car_model' => 'Toyota',
            'car_number' => 'B123',
        ]);

        $ticket = DriverChangeRequest::factory()
            ->for($driver, 'user')
            ->forField($field)
            ->create(array_merge([
                'old_value' => $oldValue,
                'new_value' => $newValue,
            ], $ticketOverrides));

        return [$driver, $ticket];
    }

    /**
     * Test that the index page displays tickets.
     */
    public function test_index_displays_tickets(): void
    {
        [$driver1, $ticket1] = $this->createTicketForDriver('car_model', 'Toyota', 'Honda');
        [$driver2, $ticket2] = $this->createTicketForDriver('name', 'Old Name', 'New Name');
        [$driver3, $ticket3] = $this->createTicketForDriver('car_number', 'A111', 'B222');

        $response = $this->actingAs($this->admin)->get(route('admin.tickets.index'));

        $response->assertStatus(200);
        $response->assertSee('Honda');
        $response->assertSee('New Name');
        $response->assertSee('B222');
    }

    /**
     * Test that index filters by pending status.
     */
    public function test_index_filters_by_pending_status(): void
    {
        [$driver1, $pendingTicket1] = $this->createTicketForDriver('car_model', 'Toyota', 'PendingCar1');
        [$driver2, $pendingTicket2] = $this->createTicketForDriver('car_model', 'Toyota', 'PendingCar2');

        $driver3 = User::factory()->driver()->create();
        DriverProfile::factory()->for($driver3)->create();
        $approvedTicket = DriverChangeRequest::factory()
            ->for($driver3, 'user')
            ->approved()
            ->create(['new_value' => 'ApprovedCar']);

        $response = $this->actingAs($this->admin)->get(route('admin.tickets.index', ['status' => 'pending']));

        $response->assertStatus(200);
        $response->assertSee('PendingCar1');
        $response->assertSee('PendingCar2');
        $response->assertDontSee('ApprovedCar');
    }

    /**
     * Test that index filters by approved status.
     */
    public function test_index_filters_by_approved_status(): void
    {
        [$driver1, $pendingTicket] = $this->createTicketForDriver('car_model', 'Toyota', 'PendingOnly');

        $driver2 = User::factory()->driver()->create();
        DriverProfile::factory()->for($driver2)->create();
        $approvedTicket = DriverChangeRequest::factory()
            ->for($driver2, 'user')
            ->approved()
            ->create(['new_value' => 'ApprovedOnly']);

        $response = $this->actingAs($this->admin)->get(route('admin.tickets.index', ['status' => 'approved']));

        $response->assertStatus(200);
        $response->assertSee('ApprovedOnly');
        $response->assertDontSee('PendingOnly');
    }

    /**
     * Test that index filters by rejected status.
     */
    public function test_index_filters_by_rejected_status(): void
    {
        [$driver1, $pendingTicket] = $this->createTicketForDriver('car_model', 'Toyota', 'PendingHidden');

        $driver2 = User::factory()->driver()->create();
        DriverProfile::factory()->for($driver2)->create();
        $rejectedTicket = DriverChangeRequest::factory()
            ->for($driver2, 'user')
            ->rejected()
            ->create(['new_value' => 'RejectedVisible']);

        $response = $this->actingAs($this->admin)->get(route('admin.tickets.index', ['status' => 'rejected']));

        $response->assertStatus(200);
        $response->assertSee('RejectedVisible');
        $response->assertDontSee('PendingHidden');
    }

    /**
     * Test that index shows all tickets when no filter is applied.
     */
    public function test_index_shows_all_when_no_filter(): void
    {
        [$driver1, $pendingTicket] = $this->createTicketForDriver('car_model', 'Toyota', 'PendingAll');

        $driver2 = User::factory()->driver()->create();
        DriverProfile::factory()->for($driver2)->create();
        $approvedTicket = DriverChangeRequest::factory()
            ->for($driver2, 'user')
            ->approved()
            ->create(['new_value' => 'ApprovedAll']);

        $driver3 = User::factory()->driver()->create();
        DriverProfile::factory()->for($driver3)->create();
        $rejectedTicket = DriverChangeRequest::factory()
            ->for($driver3, 'user')
            ->rejected()
            ->create(['new_value' => 'RejectedAll']);

        $response = $this->actingAs($this->admin)->get(route('admin.tickets.index'));

        $response->assertStatus(200);
        $response->assertSee('PendingAll');
        $response->assertSee('ApprovedAll');
        $response->assertSee('RejectedAll');
    }

    /**
     * Test that the show page displays ticket details including old and new values.
     */
    public function test_show_displays_ticket_details(): void
    {
        [$driver, $ticket] = $this->createTicketForDriver('car_model', 'OldCarModel', 'NewCarModel');

        $response = $this->actingAs($this->admin)->get(route('admin.tickets.show', $ticket));

        $response->assertStatus(200);
        $response->assertSee('OldCarModel');
        $response->assertSee('NewCarModel');
        $response->assertSee('Test Driver');
    }

    /**
     * Test that approving a ticket for name updates the user name.
     */
    public function test_approve_updates_user_name(): void
    {
        [$driver, $ticket] = $this->createTicketForDriver('name', 'Test Driver', 'Updated Name');

        $response = $this->actingAs($this->admin)->post(route('admin.tickets.approve', $ticket));

        $driver->refresh();
        $ticket->refresh();

        $this->assertEquals('Updated Name', $driver->name);
        $this->assertEquals(DriverChangeRequestStatus::Approved, $ticket->status);
        $this->assertNotNull($ticket->reviewed_at);
        $this->assertEquals($this->admin->id, $ticket->reviewed_by);
    }

    /**
     * Test that approving a ticket for car_model updates the driver profile.
     */
    public function test_approve_updates_driver_profile_car_model(): void
    {
        [$driver, $ticket] = $this->createTicketForDriver('car_model', 'Toyota', 'Honda Civic');

        $this->actingAs($this->admin)->post(route('admin.tickets.approve', $ticket));

        $driver->refresh();

        $this->assertEquals('Honda Civic', $driver->driverProfile->car_model);
    }

    /**
     * Test that approving a ticket for car_number updates the driver profile.
     */
    public function test_approve_updates_driver_profile_car_number(): void
    {
        [$driver, $ticket] = $this->createTicketForDriver('car_number', 'B123', 'X999');

        $this->actingAs($this->admin)->post(route('admin.tickets.approve', $ticket));

        $driver->refresh();

        $this->assertEquals('X999', $driver->driverProfile->car_number);
    }

    /**
     * Test that approve redirects to show page with success message.
     */
    public function test_approve_redirects_to_show_with_success(): void
    {
        [$driver, $ticket] = $this->createTicketForDriver();

        $response = $this->actingAs($this->admin)->post(route('admin.tickets.approve', $ticket));

        $response->assertRedirect(route('admin.tickets.show', $ticket));
        $response->assertSessionHas('success');
    }

    /**
     * Test that an already approved ticket cannot be approved again.
     */
    public function test_cannot_approve_already_approved_ticket(): void
    {
        $driver = User::factory()->driver()->create();
        DriverProfile::factory()->for($driver)->create();

        $ticket = DriverChangeRequest::factory()
            ->for($driver, 'user')
            ->approved()
            ->create();

        $response = $this->actingAs($this->admin)->post(route('admin.tickets.approve', $ticket));

        $response->assertStatus(409);
    }

    /**
     * Test that an already rejected ticket cannot be approved.
     */
    public function test_cannot_approve_already_rejected_ticket(): void
    {
        $driver = User::factory()->driver()->create();
        DriverProfile::factory()->for($driver)->create();

        $ticket = DriverChangeRequest::factory()
            ->for($driver, 'user')
            ->rejected()
            ->create();

        $response = $this->actingAs($this->admin)->post(route('admin.tickets.approve', $ticket));

        $response->assertStatus(409);
    }

    /**
     * Test that rejecting a ticket sets status and saves admin comment.
     */
    public function test_reject_sets_status_and_comment(): void
    {
        [$driver, $ticket] = $this->createTicketForDriver();

        $response = $this->actingAs($this->admin)->post(route('admin.tickets.reject', $ticket), [
            'admin_comment' => 'Invalid request',
        ]);

        $ticket->refresh();

        $this->assertEquals(DriverChangeRequestStatus::Rejected, $ticket->status);
        $this->assertEquals('Invalid request', $ticket->admin_comment);
        $this->assertNotNull($ticket->reviewed_at);
        $this->assertEquals($this->admin->id, $ticket->reviewed_by);
    }

    /**
     * Test that rejecting without a comment is allowed.
     */
    public function test_reject_without_comment(): void
    {
        [$driver, $ticket] = $this->createTicketForDriver();

        $response = $this->actingAs($this->admin)->post(route('admin.tickets.reject', $ticket));

        $ticket->refresh();

        $this->assertEquals(DriverChangeRequestStatus::Rejected, $ticket->status);
        $this->assertNull($ticket->admin_comment);
    }

    /**
     * Test that reject validates admin_comment max length of 500 characters.
     */
    public function test_reject_comment_max_500_chars(): void
    {
        [$driver, $ticket] = $this->createTicketForDriver();

        $response = $this->actingAs($this->admin)->post(route('admin.tickets.reject', $ticket), [
            'admin_comment' => str_repeat('a', 501),
        ]);

        $response->assertSessionHasErrors('admin_comment');
        $ticket->refresh();
        $this->assertEquals(DriverChangeRequestStatus::Pending, $ticket->status);
    }

    /**
     * Test that an already reviewed ticket cannot be rejected.
     */
    public function test_cannot_reject_already_reviewed_ticket(): void
    {
        $driver = User::factory()->driver()->create();
        DriverProfile::factory()->for($driver)->create();

        $ticket = DriverChangeRequest::factory()
            ->for($driver, 'user')
            ->approved()
            ->create();

        $response = $this->actingAs($this->admin)->post(route('admin.tickets.reject', $ticket), [
            'admin_comment' => 'Too late',
        ]);

        $response->assertStatus(409);
    }

    /**
     * Test that unauthenticated users are redirected from tickets.
     */
    public function test_unauthenticated_user_redirected_from_tickets(): void
    {
        $response = $this->get(route('admin.tickets.index'));

        $this->assertNotEquals(200, $response->getStatusCode());
    }

    /**
     * Test that non-admin users cannot access tickets.
     */
    public function test_non_admin_user_cannot_access_tickets(): void
    {
        $driver = User::factory()->driver()->create();

        $response = $this->actingAs($driver)->get(route('admin.tickets.index'));

        $response->assertRedirect(route('admin.login'));
    }

    /**
     * Test that show page hides action buttons for already reviewed tickets.
     */
    public function test_show_hides_actions_for_reviewed_ticket(): void
    {
        $driver = User::factory()->driver()->create();
        DriverProfile::factory()->for($driver)->create();

        $ticket = DriverChangeRequest::factory()
            ->for($driver, 'user')
            ->approved()
            ->create();

        $response = $this->actingAs($this->admin)->get(route('admin.tickets.show', $ticket));

        $response->assertStatus(200);
        $response->assertDontSee('Approve</button>', false);
        $response->assertDontSee('Reject</button>', false);
    }

    /**
     * Test that the admin sidebar contains a link to tickets.
     */
    public function test_sidebar_shows_tickets_link(): void
    {
        $response = $this->actingAs($this->admin)->get(route('admin.dashboard'));

        $response->assertStatus(200);
        $response->assertSee(route('admin.tickets.index'));
    }
}
