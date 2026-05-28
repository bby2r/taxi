<?php

namespace Tests\Feature\Services;

use App\Enums\IntercityBookingStatus;
use App\Enums\IntercityTripStatus;
use App\Enums\UserRole;
use App\Models\DriverProfile;
use App\Models\IntercityBooking;
use App\Models\IntercityRoute;
use App\Models\IntercityRouteSchedule;
use App\Models\IntercityTrip;
use App\Models\Region;
use App\Models\Setting;
use App\Models\User;
use App\Services\ExpoPushService;
use App\Services\IntercityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use RuntimeException;
use Tests\TestCase;

/**
 * Slot-модель межгорода (Option C: admin-scheduled + driver-claimed).
 *  - generateSlotsForDate из расписаний
 *  - claimSlot гонка/валидация accepts_intercity
 *  - createBooking → auto-promote Claimed → Ready
 *  - cancelBookingByClient → Ready → Claimed (освобождение места)
 *  - lifecycle: claim → start → complete (+ комиссия)
 *  - cancelTripByDriver: пассажирам пуш отмены
 *  - expireStaleSlots
 *  - markPassengerNoShow
 */
class IntercityServiceTest extends TestCase
{
    use RefreshDatabase;

    private IntercityService $service;

    private Region $talas;

    private Region $bishkek;

    private IntercityRoute $route;

    private User $driver;

    protected function setUp(): void
    {
        parent::setUp();

        // Push отключаем — иначе тесты пытались бы лезть в Expo API.
        $this->app->bind(ExpoPushService::class, fn () => new class extends ExpoPushService
        {
            public function __construct() {}

            public function sendOfferToDriver(User $driver, string $title, string $body, array $data = []): bool
            {
                return true;
            }

            public function sendToUser(User $user, string $title, string $body, array $data = [], array $options = []): bool
            {
                return true;
            }
        });

        $this->service = app(IntercityService::class);

        $this->talas = Region::factory()->create(['name' => 'Талас']);
        $this->bishkek = Region::factory()->create(['name' => 'Бишкек']);
        $this->route = IntercityRoute::create([
            'from_region_id' => $this->talas->id,
            'to_region_id' => $this->bishkek->id,
            'max_seats' => 4,
            'price_per_seat' => 600,
            'is_active' => true,
            'sort_order' => 0,
        ]);

        $this->driver = User::factory()->driver()->create();
        DriverProfile::factory()
            ->for($this->driver)
            ->online()
            ->create(['accepts_intercity' => true]);
    }

    private function makeSlot(?Carbon $departureAt = null, ?int $maxSeats = null): IntercityTrip
    {
        $at = $departureAt ?? Carbon::now('Asia/Bishkek')->addDay()->setTime(7, 0);

        return IntercityTrip::create([
            'route_id' => $this->route->id,
            'driver_id' => null,
            'departure_date' => $at->copy()->toDateString(),
            'departure_at' => $at,
            'max_seats' => $maxSeats ?? $this->route->max_seats,
            'price_per_seat' => $this->route->price_per_seat,
            'status' => IntercityTripStatus::Open,
        ]);
    }

    public function test_generate_slots_creates_one_per_active_schedule_for_today(): void
    {
        $today = Carbon::now('Asia/Bishkek');
        // bit-mask со всеми днями недели — гарантированно runsOn=true
        $allDays = (1 << 7) - 1;

        IntercityRouteSchedule::create([
            'route_id' => $this->route->id,
            'days_of_week' => $allDays,
            'departure_time' => '07:00:00',
            'max_seats' => 7,
            'price_per_seat' => 600,
            'is_active' => true,
        ]);
        IntercityRouteSchedule::create([
            'route_id' => $this->route->id,
            'days_of_week' => $allDays,
            'departure_time' => '12:00:00',
            'max_seats' => 7,
            'price_per_seat' => 600,
            'is_active' => false, // не активно — не должно создаться
        ]);

        $created = $this->service->generateSlotsForDate($today);
        $this->assertSame(1, $created);

        // Повторный запуск идемпотентен — не дублирует.
        $again = $this->service->generateSlotsForDate($today);
        $this->assertSame(0, $again);
    }

    public function test_claim_slot_requires_accepts_intercity(): void
    {
        $slot = $this->makeSlot();
        $otherDriver = User::factory()->driver()->create();
        DriverProfile::factory()->for($otherDriver)->online()->create([
            'accepts_intercity' => false,
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('не включён межгород');

        $this->service->claimSlot($slot, $otherDriver);
    }

    public function test_claim_slot_rejects_when_driver_has_active_trip(): void
    {
        $first = $this->makeSlot();
        $second = $this->makeSlot(Carbon::now('Asia/Bishkek')->addDays(2)->setTime(7, 0));
        $this->service->claimSlot($first, $this->driver);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('активный межгород');

        $this->service->claimSlot($second, $this->driver);
    }

    public function test_claim_slot_rejects_when_already_taken(): void
    {
        $slot = $this->makeSlot();
        $this->service->claimSlot($slot, $this->driver);

        $other = User::factory()->driver()->create();
        DriverProfile::factory()->for($other)->online()->create(['accepts_intercity' => true]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('занят другим водителем');

        $this->service->claimSlot($slot->fresh(), $other);
    }

    public function test_claim_slot_snapshots_driver_and_car(): void
    {
        $slot = $this->makeSlot();
        $claimed = $this->service->claimSlot($slot, $this->driver);

        $this->assertSame(IntercityTripStatus::Claimed, $claimed->status);
        $this->assertSame($this->driver->id, $claimed->driver_id);
        $this->assertSame($this->driver->name, $claimed->driver_name);
        $this->assertSame($this->driver->phone, $claimed->driver_phone);
        $this->assertSame($this->driver->driverProfile->car_model, $claimed->car_model);
        $this->assertSame($this->driver->driverProfile->car_number, $claimed->car_number);
        $this->assertNotNull($claimed->accepted_at);
    }

    public function test_create_booking_promotes_claimed_slot_to_ready_when_full(): void
    {
        $slot = $this->makeSlot(maxSeats: 2);
        $this->service->claimSlot($slot, $this->driver);

        $c1 = User::factory()->create(['role' => UserRole::Client]);
        $c2 = User::factory()->create(['role' => UserRole::Client]);

        $this->service->createBooking($c1, $slot->fresh(), 1);
        $this->assertSame(IntercityTripStatus::Claimed, $slot->fresh()->status);

        $this->service->createBooking($c2, $slot->fresh(), 1);
        $this->assertSame(IntercityTripStatus::Ready, $slot->fresh()->status);
    }

    public function test_create_booking_rejects_more_seats_than_remaining(): void
    {
        $slot = $this->makeSlot(maxSeats: 2);
        $this->service->claimSlot($slot, $this->driver);

        $c1 = User::factory()->create(['role' => UserRole::Client]);
        $this->service->createBooking($c1, $slot->fresh(), 1);

        $c2 = User::factory()->create(['role' => UserRole::Client]);
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Свободно только');

        $this->service->createBooking($c2, $slot->fresh(), 2);
    }

    public function test_create_booking_rejects_when_slot_closed(): void
    {
        $slot = $this->makeSlot();
        $this->service->claimSlot($slot, $this->driver);
        $this->service->closeSlot($slot->fresh(), $this->driver);

        $client = User::factory()->create(['role' => UserRole::Client]);
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('больше нельзя забронировать');

        $this->service->createBooking($client, $slot->fresh(), 1);
    }

    public function test_cancel_booking_reverts_ready_slot_to_claimed(): void
    {
        $slot = $this->makeSlot(maxSeats: 1);
        $this->service->claimSlot($slot, $this->driver);

        $client = User::factory()->create(['role' => UserRole::Client]);
        $booking = $this->service->createBooking($client, $slot->fresh(), 1);
        $this->assertSame(IntercityTripStatus::Ready, $slot->fresh()->status);

        $this->service->cancelBookingByClient($booking, $client);
        $this->assertSame(IntercityTripStatus::Claimed, $slot->fresh()->status);
    }

    public function test_start_and_complete_trip_lifecycle_with_commission(): void
    {
        $slot = $this->makeSlot();
        $this->service->claimSlot($slot, $this->driver);

        for ($i = 0; $i < 4; $i++) {
            $c = User::factory()->create(['role' => UserRole::Client]);
            $this->service->createBooking($c, $slot->fresh(), 1);
        }

        $started = $this->service->startTrip($slot->fresh(), $this->driver);
        $this->assertSame(IntercityTripStatus::EnRoute, $started->status);
        $this->assertNotNull($started->departed_at);
        foreach ($started->bookings as $b) {
            $this->assertSame(IntercityBookingStatus::EnRoute, $b->status);
        }

        $completed = $this->service->completeTrip($started, $this->driver);
        $this->assertSame(IntercityTripStatus::Completed, $completed->status);
        // 4 × 600 = 2400, по дефолту 7% = 168.
        $this->assertSame(168, $completed->commission_amount);
        foreach ($completed->bookings as $b) {
            $this->assertSame(IntercityBookingStatus::Completed, $b->status);
        }
    }

    public function test_only_owner_driver_can_start_trip(): void
    {
        $slot = $this->makeSlot();
        $this->service->claimSlot($slot, $this->driver);

        $other = User::factory()->driver()->create();
        DriverProfile::factory()->for($other)->online()->create(['accepts_intercity' => true]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('не ваша');

        $this->service->startTrip($slot->fresh(), $other);
    }

    public function test_complete_uses_custom_commission_rate(): void
    {
        Setting::updateOrCreate(['key' => 'commission_rate'], ['value' => '10']);

        $slot = $this->makeSlot();
        $this->service->claimSlot($slot, $this->driver);
        for ($i = 0; $i < 4; $i++) {
            $c = User::factory()->create(['role' => UserRole::Client]);
            $this->service->createBooking($c, $slot->fresh(), 1);
        }
        $this->service->startTrip($slot->fresh(), $this->driver);
        $done = $this->service->completeTrip($slot->fresh(), $this->driver);

        $this->assertSame(240, $done->commission_amount);
    }

    public function test_cancel_trip_by_driver_cascades_to_bookings(): void
    {
        $slot = $this->makeSlot();
        $this->service->claimSlot($slot, $this->driver);
        $client = User::factory()->create(['role' => UserRole::Client]);
        $this->service->createBooking($client, $slot->fresh(), 1);

        $cancelled = $this->service->cancelTripByDriver($slot->fresh(), $this->driver);
        $this->assertSame(IntercityTripStatus::Cancelled, $cancelled->status);
        $this->assertSame('driver', $cancelled->cancelled_by);

        $booking = IntercityBooking::where('client_id', $client->id)->firstOrFail();
        $this->assertSame(IntercityBookingStatus::Cancelled, $booking->status);
        $this->assertSame('driver', $booking->cancelled_by);
    }

    public function test_client_can_cancel_own_booking(): void
    {
        $slot = $this->makeSlot();
        $this->service->claimSlot($slot, $this->driver);
        $client = User::factory()->create(['role' => UserRole::Client]);
        $booking = $this->service->createBooking($client, $slot->fresh(), 1);

        $cancelled = $this->service->cancelBookingByClient($booking, $client);
        $this->assertSame(IntercityBookingStatus::Cancelled, $cancelled->status);
        $this->assertSame('client', $cancelled->cancelled_by);
    }

    public function test_other_client_cannot_cancel(): void
    {
        $slot = $this->makeSlot();
        $this->service->claimSlot($slot, $this->driver);
        $client = User::factory()->create(['role' => UserRole::Client]);
        $booking = $this->service->createBooking($client, $slot->fresh(), 1);

        $stranger = User::factory()->create(['role' => UserRole::Client]);
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('не ваша');

        $this->service->cancelBookingByClient($booking, $stranger);
    }

    public function test_no_show_only_for_owners_active_booking(): void
    {
        $slot = $this->makeSlot();
        $this->service->claimSlot($slot, $this->driver);
        $client = User::factory()->create(['role' => UserRole::Client]);
        $booking = $this->service->createBooking($client, $slot->fresh(), 1);

        $updated = $this->service->markPassengerNoShow($booking->fresh(), $this->driver);
        $this->assertSame(IntercityBookingStatus::NoShow, $updated->status);

        $other = User::factory()->driver()->create();
        DriverProfile::factory()->for($other)->online()->create(['accepts_intercity' => true]);

        $newClient = User::factory()->create(['role' => UserRole::Client]);
        $newBooking = IntercityBooking::create([
            'route_id' => $this->route->id,
            'client_id' => $newClient->id,
            'trip_id' => $slot->id,
            'departure_date' => $slot->departure_date,
            'seats_count' => 1,
            'status' => IntercityBookingStatus::Matched,
            'matched_at' => now(),
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('не вашего рейса');

        $this->service->markPassengerNoShow($newBooking, $other);
    }

    public function test_expire_stale_slots_cancels_slots_past_grace_window(): void
    {
        // Slot, время выезда 1 час назад, никто не claim.
        $stale = $this->makeSlot(Carbon::now('Asia/Bishkek')->subHour());
        // Свежий slot — не трогаем.
        $fresh = $this->makeSlot(Carbon::now('Asia/Bishkek')->addHour());

        $count = $this->service->expireStaleSlots();

        $this->assertSame(1, $count);
        $this->assertSame(IntercityTripStatus::Cancelled, $stale->fresh()->status);
        $this->assertSame('system', $stale->fresh()->cancelled_by);
        $this->assertSame(IntercityTripStatus::Open, $fresh->fresh()->status);
    }

    public function test_total_revenue_handles_multi_seat_bookings(): void
    {
        $slot = $this->makeSlot();
        $this->service->claimSlot($slot, $this->driver);

        $c1 = User::factory()->create(['role' => UserRole::Client]);
        $c2 = User::factory()->create(['role' => UserRole::Client]);
        $this->service->createBooking($c1, $slot->fresh(), 2);
        $this->service->createBooking($c2, $slot->fresh(), 2);

        $loaded = $slot->fresh(['bookings']);
        $this->assertSame(2400, $loaded->totalRevenue());
    }
}
