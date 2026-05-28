<?php

namespace App\Services;

use App\Enums\IntercityBookingStatus;
use App\Enums\IntercityTripStatus;
use App\Models\IntercityBooking;
use App\Models\IntercityRoute;
use App\Models\IntercityRouteSchedule;
use App\Models\IntercityTrip;
use App\Models\Region;
use App\Models\Setting;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class IntercityService
{
    public function __construct(
        private readonly ExpoPushService $pushService,
        private readonly GeoService $geoService,
    ) {}

    /* ───────────────────────────────────────────────────────────
     * SCHEDULE → SLOT GENERATION
     * ─────────────────────────────────────────────────────────── */

    /**
     * Создаёт slot'ы (intercity_trips status=open) на дату по активным
     * расписаниям. Идемпотентно — повторный вызов на ту же дату не
     * создаёт дублей (проверка route+schedule+date уникальности).
     *
     * @return int количество созданных slot'ов
     */
    public function generateSlotsForDate(Carbon $date): int
    {
        $schedules = IntercityRouteSchedule::query()
            ->active()
            ->with('route')
            ->get()
            ->filter(fn (IntercityRouteSchedule $s) => $s->runsOn($date));

        $created = 0;
        foreach ($schedules as $schedule) {
            $exists = IntercityTrip::query()
                ->where('schedule_id', $schedule->id)
                ->whereDate('departure_date', $date)
                ->exists();
            if ($exists) {
                continue;
            }

            IntercityTrip::create([
                'route_id' => $schedule->route_id,
                'schedule_id' => $schedule->id,
                'driver_id' => null,
                'departure_date' => $date->toDateString(),
                'departure_at' => $schedule->departureAtFor($date),
                'max_seats' => $schedule->max_seats,
                'price_per_seat' => $schedule->price_per_seat,
                'status' => IntercityTripStatus::Open,
            ]);
            $created++;
        }

        return $created;
    }

    /* ───────────────────────────────────────────────────────────
     * DRIVER ACTIONS (claim / close / cancel / lifecycle)
     * ─────────────────────────────────────────────────────────── */

    /**
     * Водитель берёт открытый slot. Проверяет: водитель accepts_intercity,
     * slot ещё open, у водителя нет другого активного intercity-трипа.
     */
    public function claimSlot(IntercityTrip $trip, User $driver): IntercityTrip
    {
        $driver->loadMissing('driverProfile');

        if ($driver->driverProfile?->accepts_intercity !== true) {
            throw new RuntimeException('У вас не включён межгород. Свяжитесь с диспетчером.');
        }

        $hasActive = IntercityTrip::query()
            ->where('driver_id', $driver->id)
            ->active()
            ->exists();
        if ($hasActive) {
            throw new RuntimeException('У вас уже есть активный межгород-рейс.');
        }

        return DB::transaction(function () use ($trip, $driver) {
            $fresh = IntercityTrip::lockForUpdate()->findOrFail($trip->id);

            if ($fresh->status !== IntercityTripStatus::Open) {
                throw new RuntimeException('Этот рейс уже занят другим водителем.');
            }

            $fresh->update([
                'driver_id' => $driver->id,
                'driver_name' => $driver->name,
                'driver_phone' => $driver->phone,
                'car_model' => $driver->driverProfile?->car_model,
                'car_number' => $driver->driverProfile?->car_number,
                'status' => IntercityTripStatus::Claimed,
                'accepted_at' => now(),
            ]);

            // Снимаем с городской линии — пока везёт 7 пассажиров в
            // Бишкек, обычные заказы ему присылать нельзя.
            $driver->driverProfile?->update(['is_online' => false]);

            DB::afterCommit(fn () => $this->notifyPassengersTripClaimed($fresh->fresh()));

            return $fresh->fresh(['bookings']);
        });
    }

    /**
     * Водитель «закрывает» slot вручную — обычно потому что подобрал
     * пассажира с улицы. Новые брони блокируются (UI пометит «полная»).
     * Уже забронированные остаются в силе.
     */
    public function closeSlot(IntercityTrip $trip, User $driver): IntercityTrip
    {
        if ($trip->driver_id !== $driver->id) {
            throw new RuntimeException('Этот рейс не ваш.');
        }
        if (! in_array($trip->status, [IntercityTripStatus::Claimed, IntercityTripStatus::Ready], true)) {
            throw new RuntimeException('Закрыть можно только принятый рейс.');
        }

        $trip->update(['is_closed' => true]);

        return $trip->fresh();
    }

    public function startTrip(IntercityTrip $trip, User $driver): IntercityTrip
    {
        if ($trip->driver_id !== $driver->id) {
            throw new RuntimeException('Эта поездка не ваша.');
        }
        if (! in_array($trip->status, [IntercityTripStatus::Claimed, IntercityTripStatus::Ready], true)) {
            throw new RuntimeException('Поездку можно начать только из принятого или готового статуса.');
        }

        DB::transaction(function () use ($trip) {
            $trip->update([
                'status' => IntercityTripStatus::EnRoute,
                'departed_at' => now(),
            ]);
            $trip->bookings()
                ->where('status', IntercityBookingStatus::Matched)
                ->update(['status' => IntercityBookingStatus::EnRoute]);
        });

        DB::afterCommit(fn () => $this->notifyPassengersDriverEnRoute($trip->fresh()));

        return $trip->fresh();
    }

    public function completeTrip(IntercityTrip $trip, User $driver): IntercityTrip
    {
        if ($trip->driver_id !== $driver->id) {
            throw new RuntimeException('Эта поездка не ваша.');
        }
        if ($trip->status !== IntercityTripStatus::EnRoute) {
            throw new RuntimeException('Можно завершить только начатую поездку.');
        }

        $trip->loadMissing('bookings');
        $totalRevenue = $trip->totalRevenue();
        $commissionRate = (int) Setting::getValue('commission_rate', 7);
        $commission = (int) round($totalRevenue * $commissionRate / 100);

        DB::transaction(function () use ($trip, $commission) {
            $trip->update([
                'status' => IntercityTripStatus::Completed,
                'completed_at' => now(),
                'commission_amount' => $commission,
            ]);
            $trip->bookings()
                ->whereIn('status', [
                    IntercityBookingStatus::Matched,
                    IntercityBookingStatus::EnRoute,
                ])
                ->update([
                    'status' => IntercityBookingStatus::Completed,
                    'completed_at' => now(),
                ]);
        });

        return $trip->fresh();
    }

    /**
     * Водитель отменяет принятый slot (сломалась машина, болезнь).
     * Все active бронь возвращаются как Cancelled, пассажирам пуш
     * «водитель отменил, поищите другой рейс». Slot не удаляем —
     * status=Cancelled, чтоб видна история.
     */
    public function cancelTripByDriver(IntercityTrip $trip, User $driver): IntercityTrip
    {
        if ($trip->driver_id !== $driver->id) {
            throw new RuntimeException('Эта поездка не ваша.');
        }
        if ($trip->status === IntercityTripStatus::Completed) {
            throw new RuntimeException('Завершённую поездку нельзя отменить.');
        }
        if ($trip->status === IntercityTripStatus::Cancelled) {
            throw new RuntimeException('Поездка уже отменена.');
        }

        DB::transaction(function () use ($trip) {
            $trip->update([
                'status' => IntercityTripStatus::Cancelled,
                'cancelled_at' => now(),
                'cancelled_by' => 'driver',
            ]);
            $trip->bookings()
                ->whereIn('status', [
                    IntercityBookingStatus::Matched,
                    IntercityBookingStatus::EnRoute,
                ])
                ->update([
                    'status' => IntercityBookingStatus::Cancelled,
                    'cancelled_at' => now(),
                    'cancelled_by' => 'driver',
                ]);
        });

        DB::afterCommit(fn () => $this->notifyPassengersTripCancelledByDriver($trip->fresh()));

        return $trip->fresh();
    }

    /**
     * Админ закрывает slot (новые бронь блокируются). В отличие от
     * closeSlot не требует владения — диспетчер может закрыть любого
     * водителя.
     */
    public function closeSlotByAdmin(IntercityTrip $trip): IntercityTrip
    {
        if (! in_array($trip->status, [IntercityTripStatus::Claimed, IntercityTripStatus::Ready], true)) {
            throw new RuntimeException('Закрыть можно только принятый рейс.');
        }

        $trip->update(['is_closed' => true]);

        return $trip->fresh();
    }

    /**
     * Админ отменяет slot. Используется когда водитель не выходит на
     * связь, ломается машина и т.д. — водителю самостоятельно отменять
     * нельзя, чтобы не было соблазна сливать пассажиров без причины.
     */
    public function cancelTripByAdmin(IntercityTrip $trip): IntercityTrip
    {
        if ($trip->status === IntercityTripStatus::Completed) {
            throw new RuntimeException('Завершённую поездку нельзя отменить.');
        }
        if ($trip->status === IntercityTripStatus::Cancelled) {
            throw new RuntimeException('Поездка уже отменена.');
        }

        DB::transaction(function () use ($trip) {
            $trip->update([
                'status' => IntercityTripStatus::Cancelled,
                'cancelled_at' => now(),
                'cancelled_by' => 'admin',
            ]);
            $trip->bookings()
                ->whereIn('status', [
                    IntercityBookingStatus::Matched,
                    IntercityBookingStatus::EnRoute,
                ])
                ->update([
                    'status' => IntercityBookingStatus::Cancelled,
                    'cancelled_at' => now(),
                    'cancelled_by' => 'admin',
                ]);
        });

        DB::afterCommit(fn () => $this->notifyPassengersTripCancelledByDriver($trip->fresh()));

        return $trip->fresh();
    }

    /**
     * Водитель отмечает не-явку пассажира. Trip продолжается, no-show
     * считается для отчётности.
     */
    public function markPassengerNoShow(IntercityBooking $booking, User $driver): IntercityBooking
    {
        $booking->loadMissing('trip');
        if ($booking->trip?->driver_id !== $driver->id) {
            throw new RuntimeException('Эта бронь не вашего рейса.');
        }
        if (! in_array($booking->status, [
            IntercityBookingStatus::Matched,
            IntercityBookingStatus::EnRoute,
        ], true)) {
            throw new RuntimeException('Можно отметить только активную бронь.');
        }

        $booking->update([
            'status' => IntercityBookingStatus::NoShow,
        ]);

        return $booking->fresh();
    }

    /* ───────────────────────────────────────────────────────────
     * CLIENT BOOKINGS
     * ─────────────────────────────────────────────────────────── */

    /**
     * Клиент бронит место(а) в конкретном slot'е. Trip автоматически
     * переходит в Ready когда seats заполнены.
     */
    public function createBooking(
        User $client,
        IntercityTrip $trip,
        int $seatsCount,
        ?string $pickupAddress = null,
    ): IntercityBooking {
        if ($seatsCount < 1 || $seatsCount > 3) {
            throw new RuntimeException('Можно забронировать от 1 до 3 мест.');
        }

        $existing = IntercityBooking::query()
            ->where('client_id', $client->id)
            ->active()
            ->first();
        if ($existing !== null) {
            throw new RuntimeException('У вас уже есть активная бронь межгорода.');
        }

        return DB::transaction(function () use ($client, $trip, $seatsCount, $pickupAddress) {
            $fresh = IntercityTrip::lockForUpdate()->findOrFail($trip->id);

            if (! in_array($fresh->status, IntercityTripStatus::bookableStatuses(), true) || $fresh->is_closed) {
                throw new RuntimeException('В этот рейс больше нельзя забронировать место.');
            }

            $occupied = (int) IntercityBooking::query()
                ->where('trip_id', $fresh->id)
                ->whereIn('status', [
                    IntercityBookingStatus::Matched,
                    IntercityBookingStatus::EnRoute,
                ])
                ->sum('seats_count');

            $remaining = $fresh->max_seats - $occupied;
            if ($seatsCount > $remaining) {
                throw new RuntimeException(
                    "Свободно только {$remaining} мест(а)."
                );
            }

            $booking = IntercityBooking::create([
                'route_id' => $fresh->route_id,
                'client_id' => $client->id,
                'trip_id' => $fresh->id,
                'departure_date' => $fresh->departure_date->toDateString(),
                'seats_count' => $seatsCount,
                'pickup_address' => $pickupAddress,
                'client_name' => $client->name,
                'client_phone' => $client->phone,
                'status' => IntercityBookingStatus::Matched,
                'matched_at' => now(),
            ]);

            // Slot заполнился → status Ready (если был Claimed).
            // Водителю пуш «можно выезжать».
            if ($occupied + $seatsCount >= $fresh->max_seats && $fresh->status === IntercityTripStatus::Claimed) {
                $fresh->update(['status' => IntercityTripStatus::Ready]);
                DB::afterCommit(fn () => $this->notifyDriverSlotReady($fresh->fresh()));
            }

            return $booking->fresh();
        });
    }

    public function cancelBookingByClient(IntercityBooking $booking, User $client): IntercityBooking
    {
        if ($booking->client_id !== $client->id) {
            throw new RuntimeException('Эта бронь не ваша.');
        }
        if (in_array($booking->status, [
            IntercityBookingStatus::Completed,
            IntercityBookingStatus::Cancelled,
            IntercityBookingStatus::NoShow,
        ], true)) {
            throw new RuntimeException('Эту бронь уже нельзя отменить.');
        }

        $tripId = $booking->trip_id;
        $booking->update([
            'status' => IntercityBookingStatus::Cancelled,
            'cancelled_at' => now(),
            'cancelled_by' => 'client',
        ]);

        // Slot был Ready (полон) → опять Claimed (есть свободное место).
        if ($tripId !== null) {
            $trip = IntercityTrip::find($tripId);
            if ($trip !== null) {
                if ($trip->status === IntercityTripStatus::Ready) {
                    $trip->update(['status' => IntercityTripStatus::Claimed]);
                }
                DB::afterCommit(fn () => $this->notifyDriverPassengerCancelled($trip));
            }
        }

        return $booking->fresh();
    }

    /* ───────────────────────────────────────────────────────────
     * EXPIRY (cron)
     * ─────────────────────────────────────────────────────────── */

    /**
     * Слоты у которых departure_at прошло 30 мин назад и трип всё ещё
     * Open/Claimed → отменяем. Возвращает количество отменённых.
     * Вызывается ExpireStaleSlotsCommand раз в час.
     */
    public function expireStaleSlots(): int
    {
        $cutoff = now()->subMinutes(30);
        $stale = IntercityTrip::query()
            ->whereIn('status', [IntercityTripStatus::Open, IntercityTripStatus::Claimed])
            ->where('departure_at', '<', $cutoff)
            ->with(['bookings.client', 'driver'])
            ->get();

        foreach ($stale as $trip) {
            DB::transaction(function () use ($trip) {
                $trip->update([
                    'status' => IntercityTripStatus::Cancelled,
                    'cancelled_at' => now(),
                    'cancelled_by' => 'system',
                ]);
                $trip->bookings()
                    ->whereIn('status', [
                        IntercityBookingStatus::Matched,
                        IntercityBookingStatus::EnRoute,
                    ])
                    ->update([
                        'status' => IntercityBookingStatus::Cancelled,
                        'cancelled_at' => now(),
                        'cancelled_by' => 'system',
                    ]);
            });

            DB::afterCommit(fn () => $this->notifyPassengersSlotExpired($trip->fresh()));
        }

        return $stale->count();
    }

    /* ───────────────────────────────────────────────────────────
     * PUSH NOTIFICATIONS
     * ─────────────────────────────────────────────────────────── */

    /**
     * Подходящие водители для рассылки оффера «есть открытый slot».
     * Фильтры: accepts_intercity=true, в зоне обслуживания from_region
     * (GPS-фильтр), без активного intercity-трипа.
     *
     * @return Collection<int, User>
     */
    private function eligibleIntercityDrivers(IntercityRoute $route): Collection
    {
        $route->loadMissing('fromRegion');
        $from = $route->fromRegion;

        $base = User::query()
            ->whereHas('driverProfile', function ($q) {
                $q->where('accepts_intercity', true)
                    ->online()
                    ->notBlocked();
            })
            ->whereDoesntHave('intercityDriverTrips', fn ($q) => $q->active());

        if ($from === null || $from->center_latitude === null || $from->center_longitude === null) {
            return $base->get();
        }

        $nearby = $this->geoService->findNearestDrivers(
            (float) $from->center_latitude,
            (float) $from->center_longitude,
            limit: 100,
            maxRadiusKm: Region::detectionMaxKm(),
        );
        $userIds = $nearby->pluck('user_id')->all();
        if ($userIds === []) {
            return new Collection;
        }

        return $base->whereIn('id', $userIds)->get();
    }

    private function notifyDriverSlotReady(IntercityTrip $trip): void
    {
        $driver = $trip->driver;
        if ($driver === null) {
            return;
        }
        $trip->loadMissing(['route.fromRegion', 'route.toRegion']);
        $this->pushService->sendToUser(
            $driver,
            'Машина полная — можно выезжать',
            "{$trip->route->fromRegion->name} → {$trip->route->toRegion->name}, ".
            "{$trip->max_seats} пассажиров",
            ['type' => 'intercity_slot_ready', 'trip_id' => $trip->id],
        );
    }

    private function notifyPassengersTripClaimed(IntercityTrip $trip): void
    {
        $trip->loadMissing(['bookings.client', 'route.fromRegion', 'route.toRegion']);
        $body = "{$trip->driver_name} ({$trip->car_model} {$trip->car_number}) ".
            "везёт вас {$trip->route->fromRegion->name} → {$trip->route->toRegion->name}";
        $this->notifyTripPassengers($trip, 'Водитель найден!', $body, 'intercity_claimed');
    }

    private function notifyPassengersDriverEnRoute(IntercityTrip $trip): void
    {
        $trip->loadMissing('bookings.client');
        $body = "{$trip->driver_name} едет за вами. {$trip->car_model} {$trip->car_number}";
        $this->notifyTripPassengers($trip, 'Водитель выехал', $body, 'intercity_en_route');
    }

    private function notifyPassengersTripCancelledByDriver(IntercityTrip $trip): void
    {
        $trip->loadMissing(['bookings.client', 'route.fromRegion', 'route.toRegion']);
        $body = "{$trip->route->fromRegion->name} → {$trip->route->toRegion->name} в ".
            $trip->departure_at?->timezone('Asia/Bishkek')->format('H:i').
            ' — водитель отменил. Поищите другой рейс.';
        $this->notifyTripPassengers($trip, 'Рейс отменён водителем', $body, 'intercity_driver_cancelled');
    }

    private function notifyPassengersSlotExpired(IntercityTrip $trip): void
    {
        $trip->loadMissing(['bookings.client', 'route.fromRegion', 'route.toRegion']);
        $body = "{$trip->route->fromRegion->name} → {$trip->route->toRegion->name} — ".
            'не нашлось водителя. Попробуйте другой рейс.';
        $this->notifyTripPassengers($trip, 'Рейс отменён', $body, 'intercity_slot_expired');
    }

    private function notifyTripPassengers(
        IntercityTrip $trip,
        string $title,
        string $body,
        string $type,
    ): void {
        foreach ($trip->bookings as $booking) {
            if ($booking->client === null) {
                continue;
            }
            $this->pushService->sendToUser(
                $booking->client,
                $title,
                $body,
                [
                    'type' => $type,
                    'trip_id' => $trip->id,
                    'booking_id' => $booking->id,
                ],
            );
        }
    }

    private function notifyDriverPassengerCancelled(IntercityTrip $trip): void
    {
        $driver = $trip->driver;
        if ($driver === null) {
            return;
        }
        $trip->loadMissing(['route.fromRegion', 'route.toRegion']);
        $this->pushService->sendToUser(
            $driver,
            'Пассажир отменил бронь',
            "В рейсе {$trip->route->fromRegion->name} → {$trip->route->toRegion->name} освободилось место",
            ['type' => 'intercity_passenger_cancelled', 'trip_id' => $trip->id],
        );
    }
}
