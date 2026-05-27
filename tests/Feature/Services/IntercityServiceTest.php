<?php

namespace Tests\Feature\Services;

use App\Enums\IntercityBookingStatus;
use App\Enums\IntercityTripStatus;
use App\Enums\UserRole;
use App\Models\DriverProfile;
use App\Models\IntercityBooking;
use App\Models\IntercityRoute;
use App\Models\Region;
use App\Models\Setting;
use App\Models\User;
use App\Services\ExpoPushService;
use App\Services\IntercityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use RuntimeException;
use Tests\TestCase;

/**
 * Маршрутка-модель межгорода. Покрываем:
 *  - createBooking ваидация и happy-path
 *  - matching: набор max_seats → готово к принятию
 *  - acceptByDriver FIFO + race safety
 *  - state machine trip (matched→en_route→completed)
 *  - cancellation by client (освобождение места)
 *  - расчёт комиссии
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

        // Push-уведомления — фейкаем чтобы не пытались отправлять
        // реальные FCM в тестах.
        $this->app->bind(ExpoPushService::class, function () {
            return new class
            {
                public function sendOfferToDriver(...$args): void {}
            };
        });

        Event::fake();
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
        DriverProfile::factory()->for($this->driver)->online()->create();
    }

    public function test_create_booking_validates_seats_range(): void
    {
        $client = User::factory()->create(['role' => UserRole::Client]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('от 1 до 3 мест');

        $this->service->createBooking($client, $this->route, Carbon::tomorrow(), 4);
    }

    public function test_create_booking_rejects_inactive_route(): void
    {
        $client = User::factory()->create(['role' => UserRole::Client]);
        $this->route->update(['is_active' => false]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('маршрут больше не доступен');

        $this->service->createBooking($client, $this->route, Carbon::tomorrow(), 1);
    }

    public function test_create_booking_rejects_when_client_has_active_one(): void
    {
        $client = User::factory()->create(['role' => UserRole::Client]);
        $this->service->createBooking($client, $this->route, Carbon::tomorrow(), 1);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('уже есть активная бронь');

        $this->service->createBooking($client, $this->route, Carbon::tomorrow()->addDay(), 1);
    }

    public function test_create_booking_rejects_when_no_seats_left(): void
    {
        $date = Carbon::tomorrow();
        // 4 клиента занимают все 4 места
        for ($i = 0; $i < 4; $i++) {
            $c = User::factory()->create(['role' => UserRole::Client]);
            $this->service->createBooking($c, $this->route, $date, 1);
        }

        $extraClient = User::factory()->create(['role' => UserRole::Client]);
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Свободно только');

        $this->service->createBooking($extraClient, $this->route, $date, 1);
    }

    public function test_create_booking_persists_snapshot(): void
    {
        $client = User::factory()->create([
            'role' => UserRole::Client,
            'name' => 'Айбек',
            'phone' => '+996700111222',
        ]);

        $booking = $this->service->createBooking($client, $this->route, Carbon::tomorrow(), 2, 'У школы');

        $this->assertSame(IntercityBookingStatus::Pending, $booking->status);
        $this->assertSame(2, $booking->seats_count);
        $this->assertSame('Айбек', $booking->client_name);
        $this->assertSame('+996700111222', $booking->client_phone);
        $this->assertSame('У школы', $booking->pickup_address);
        $this->assertNull($booking->trip_id);
    }

    public function test_driver_accepts_when_max_seats_reached_assigns_fifo(): void
    {
        $date = Carbon::tomorrow();
        $clients = collect(range(1, 4))->map(fn ($i) => User::factory()->create([
            'role' => UserRole::Client,
            'name' => "Client$i",
        ]));

        // Заполняем 4 места 4-мя клиентами по 1 месту.
        foreach ($clients as $c) {
            $this->service->createBooking($c, $this->route, $date, 1);
        }

        $trip = $this->service->acceptByDriver($this->driver, $this->route, $date);

        $this->assertSame(IntercityTripStatus::Matched, $trip->status);
        $this->assertSame($this->driver->id, $trip->driver_id);
        $this->assertSame(4, $trip->bookings->count());
        $this->assertSame(600, $trip->price_per_seat);

        // Все 4 booking переключились в matched
        foreach ($clients as $c) {
            $b = IntercityBooking::where('client_id', $c->id)->first();
            $this->assertSame(IntercityBookingStatus::Matched, $b->status);
            $this->assertSame($trip->id, $b->trip_id);
        }
    }

    public function test_driver_cant_accept_if_seats_not_full(): void
    {
        $date = Carbon::tomorrow();
        $client = User::factory()->create(['role' => UserRole::Client]);
        $this->service->createBooking($client, $this->route, $date, 1);

        // Только 1 место занято, max_seats=4
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('не полный');

        $this->service->acceptByDriver($this->driver, $this->route, $date);
    }

    public function test_start_and_complete_trip_lifecycle(): void
    {
        $date = Carbon::tomorrow();
        for ($i = 0; $i < 4; $i++) {
            $c = User::factory()->create(['role' => UserRole::Client]);
            $this->service->createBooking($c, $this->route, $date, 1);
        }
        $trip = $this->service->acceptByDriver($this->driver, $this->route, $date);

        $trip = $this->service->startTrip($trip, $this->driver);
        $this->assertSame(IntercityTripStatus::EnRoute, $trip->status);
        $this->assertNotNull($trip->departed_at);
        foreach ($trip->bookings as $b) {
            $this->assertSame(IntercityBookingStatus::EnRoute, $b->status);
        }

        $trip = $this->service->completeTrip($trip, $this->driver);
        $this->assertSame(IntercityTripStatus::Completed, $trip->status);
        $this->assertNotNull($trip->completed_at);
        // 4 места × 600 сом = 2400 сом, комиссия 7% = 168 сом
        $this->assertSame(168, $trip->commission_amount);

        foreach ($trip->bookings as $b) {
            $this->assertSame(IntercityBookingStatus::Completed, $b->status);
        }
    }

    public function test_only_owner_driver_can_start_trip(): void
    {
        $date = Carbon::tomorrow();
        for ($i = 0; $i < 4; $i++) {
            $c = User::factory()->create(['role' => UserRole::Client]);
            $this->service->createBooking($c, $this->route, $date, 1);
        }
        $trip = $this->service->acceptByDriver($this->driver, $this->route, $date);

        $otherDriver = User::factory()->driver()->create();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('не ваша');

        $this->service->startTrip($trip, $otherDriver);
    }

    public function test_complete_trip_uses_custom_commission_rate(): void
    {
        Setting::updateOrCreate(['key' => 'commission_rate'], ['value' => '10']);

        $date = Carbon::tomorrow();
        for ($i = 0; $i < 4; $i++) {
            $c = User::factory()->create(['role' => UserRole::Client]);
            $this->service->createBooking($c, $this->route, $date, 1);
        }
        $trip = $this->service->acceptByDriver($this->driver, $this->route, $date);
        $trip = $this->service->startTrip($trip, $this->driver);
        $trip = $this->service->completeTrip($trip, $this->driver);

        // 4 × 600 = 2400, 10% = 240
        $this->assertSame(240, $trip->commission_amount);
    }

    public function test_client_can_cancel_pending_booking(): void
    {
        $client = User::factory()->create(['role' => UserRole::Client]);
        $booking = $this->service->createBooking($client, $this->route, Carbon::tomorrow(), 1);

        $cancelled = $this->service->cancelBookingByClient($booking, $client);

        $this->assertSame(IntercityBookingStatus::Cancelled, $cancelled->status);
        $this->assertSame('client', $cancelled->cancelled_by);
        $this->assertNotNull($cancelled->cancelled_at);
    }

    public function test_other_client_cant_cancel_booking(): void
    {
        $client = User::factory()->create(['role' => UserRole::Client]);
        $booking = $this->service->createBooking($client, $this->route, Carbon::tomorrow(), 1);
        $otherClient = User::factory()->create(['role' => UserRole::Client]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('не ваша');

        $this->service->cancelBookingByClient($booking, $otherClient);
    }

    public function test_cancelling_matched_booking_frees_seat_in_pool(): void
    {
        $date = Carbon::tomorrow();
        $clients = collect(range(1, 4))->map(fn () => User::factory()->create(['role' => UserRole::Client]));
        foreach ($clients as $c) {
            $this->service->createBooking($c, $this->route, $date, 1);
        }
        $trip = $this->service->acceptByDriver($this->driver, $this->route, $date);

        // Отменяем 1-ю бронь
        $firstBooking = $trip->bookings->first();
        $this->service->cancelBookingByClient($firstBooking, $firstBooking->client);

        $remainingActive = IntercityBooking::query()
            ->where('route_id', $this->route->id)
            ->whereDate('departure_date', $date)
            ->whereIn('status', [
                IntercityBookingStatus::Matched,
                IntercityBookingStatus::EnRoute,
            ])
            ->sum('seats_count');

        $this->assertSame(3, (int) $remainingActive);
    }

    public function test_completed_booking_cant_be_cancelled(): void
    {
        $client = User::factory()->create(['role' => UserRole::Client]);
        $booking = $this->service->createBooking($client, $this->route, Carbon::tomorrow(), 1);
        $booking->update(['status' => IntercityBookingStatus::Completed]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('уже нельзя отменить');

        $this->service->cancelBookingByClient($booking->fresh(), $client);
    }

    public function test_total_revenue_calculation_handles_multi_seat_bookings(): void
    {
        $date = Carbon::tomorrow();
        // 2 клиента: один на 2 места, второй на 2 места = 4 места всего
        $c1 = User::factory()->create(['role' => UserRole::Client]);
        $c2 = User::factory()->create(['role' => UserRole::Client]);
        $this->service->createBooking($c1, $this->route, $date, 2);
        $this->service->createBooking($c2, $this->route, $date, 2);

        $trip = $this->service->acceptByDriver($this->driver, $this->route, $date);

        // 2 booking × (2 seats × 600 сом) = 2400 всего
        $this->assertSame(2400, $trip->totalRevenue());
    }
}
