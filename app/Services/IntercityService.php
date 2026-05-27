<?php

namespace App\Services;

use App\Enums\IntercityBookingStatus;
use App\Enums\IntercityTripStatus;
use App\Models\IntercityBooking;
use App\Models\IntercityRoute;
use App\Models\IntercityTrip;
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
    ) {}

    /**
     * Создаёт pending-бронь клиента на конкретный route+date+seats.
     * После создания проверяет: не набрался ли batch на max_seats?
     * Если да — отправляет offer всем активным водителям в from_region.
     *
     * @throws RuntimeException если у клиента уже есть активная бронь
     *                          или маршрут неактивен / недостаточно мест
     */
    public function createBooking(
        User $client,
        IntercityRoute $route,
        Carbon $departureDate,
        int $seatsCount,
        ?string $pickupAddress = null,
    ): IntercityBooking {
        if ($seatsCount < 1 || $seatsCount > 3) {
            throw new RuntimeException('Можно забронировать от 1 до 3 мест.');
        }
        if (! $route->is_active) {
            throw new RuntimeException('Этот маршрут больше не доступен.');
        }

        // Один активный межгород-booking на клиента — чтобы не было
        // двух параллельных «ждать водителя».
        $existing = IntercityBooking::query()
            ->where('client_id', $client->id)
            ->active()
            ->first();
        if ($existing !== null) {
            throw new RuntimeException('У вас уже есть активная бронь межгорода.');
        }

        // Проверяем что в этой batch ещё есть свободные места.
        // Если пара клиентов одновременно пытаются занять последние
        // места — DB-транзакция + lockForUpdate гарантирует
        // консистентность (count + insert атомарно).
        return DB::transaction(function () use ($client, $route, $departureDate, $seatsCount, $pickupAddress) {
            $occupied = IntercityBooking::query()
                ->where('route_id', $route->id)
                ->whereDate('departure_date', $departureDate)
                ->whereIn('status', [
                    IntercityBookingStatus::Pending,
                    IntercityBookingStatus::Matched,
                    IntercityBookingStatus::EnRoute,
                ])
                ->lockForUpdate()
                ->sum('seats_count');

            $remaining = $route->max_seats - (int) $occupied;
            if ($seatsCount > $remaining) {
                throw new RuntimeException(
                    "Свободно только {$remaining} мест(а). Попробуйте другую дату."
                );
            }

            $booking = IntercityBooking::create([
                'route_id' => $route->id,
                'client_id' => $client->id,
                'trip_id' => null,
                'departure_date' => $departureDate->toDateString(),
                'seats_count' => $seatsCount,
                'pickup_address' => $pickupAddress,
                'client_name' => $client->name,
                'client_phone' => $client->phone,
                'status' => IntercityBookingStatus::Pending,
            ]);

            // Если после этой брони набралось max_seats — рассылаем
            // offer водителям. (Логика выполняется внутри транзакции
            // но push-уведомления отложим в afterCommit.)
            $newTotal = (int) $occupied + $seatsCount;
            if ($newTotal >= $route->max_seats) {
                DB::afterCommit(function () use ($route, $departureDate) {
                    $this->broadcastBatchReadyToDrivers($route, $departureDate);
                });
            }

            return $booking->fresh();
        });
    }

    /**
     * Водитель принимает batch — создаётся trip, к нему привязываются
     * старейшие pending bookings (FIFO) на эту route+date пока не
     * набралось max_seats. Если меньше → throw (значит кто-то отменил
     * в последний момент и больше не наберётся).
     */
    public function acceptByDriver(
        User $driver,
        IntercityRoute $route,
        Carbon $departureDate,
    ): IntercityTrip {
        $driver->loadMissing('driverProfile');

        return DB::transaction(function () use ($driver, $route, $departureDate) {
            // Лочим все pending bookings на этот route+date чтобы
            // другой водитель параллельно не схватил тот же batch.
            $pendingBookings = IntercityBooking::query()
                ->where('route_id', $route->id)
                ->whereDate('departure_date', $departureDate)
                ->where('status', IntercityBookingStatus::Pending)
                ->orderBy('created_at')
                ->lockForUpdate()
                ->get();

            // Набираем bookings до max_seats (FIFO). Остаток
            // (если кто-то забронировал больше mест чем влезло)
            // оставляем в pending для следующего batch.
            $accepted = [];
            $totalSeats = 0;
            foreach ($pendingBookings as $b) {
                if ($totalSeats + $b->seats_count <= $route->max_seats) {
                    $accepted[] = $b;
                    $totalSeats += $b->seats_count;
                }
            }

            if ($totalSeats < $route->max_seats) {
                throw new RuntimeException(
                    'Набор уже не полный — пассажиры отменили брони.'
                );
            }

            $trip = IntercityTrip::create([
                'route_id' => $route->id,
                'driver_id' => $driver->id,
                'departure_date' => $departureDate->toDateString(),
                'max_seats' => $route->max_seats,
                'price_per_seat' => $route->price_per_seat,
                'driver_name' => $driver->name,
                'driver_phone' => $driver->phone,
                'car_model' => $driver->driverProfile?->car_model,
                'car_number' => $driver->driverProfile?->car_number,
                'status' => IntercityTripStatus::Matched,
                'accepted_at' => now(),
            ]);

            foreach ($accepted as $booking) {
                $booking->update([
                    'trip_id' => $trip->id,
                    'status' => IntercityBookingStatus::Matched,
                    'matched_at' => now(),
                ]);
            }

            // После коммита — пуш пассажирам что водитель найден.
            DB::afterCommit(function () use ($trip) {
                $this->notifyPassengersTripMatched($trip);
            });

            return $trip->fresh(['bookings']);
        });
    }

    /**
     * Водитель выехал → trip + все его bookings → en_route, пуш
     * пассажирам «водитель в пути».
     */
    public function startTrip(IntercityTrip $trip, User $driver): IntercityTrip
    {
        if ($trip->driver_id !== $driver->id) {
            throw new RuntimeException('Эта поездка не ваша.');
        }
        if ($trip->status !== IntercityTripStatus::Matched) {
            throw new RuntimeException('Поездку можно начать только из статуса «принята».');
        }

        DB::transaction(function () use ($trip) {
            $trip->update([
                'status' => IntercityTripStatus::EnRoute,
                'departed_at' => now(),
            ]);
            $trip->bookings()->update([
                'status' => IntercityBookingStatus::EnRoute,
            ]);
        });

        DB::afterCommit(function () use ($trip) {
            $this->notifyPassengersDriverEnRoute($trip->fresh());
        });

        return $trip->fresh();
    }

    /**
     * Водитель завершил поездку — все доставлены. Считаем комиссию
     * (total_revenue * commission_rate%), фиксируем на trip.
     */
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
     * Клиент отменяет свою бронь. Если бронь уже привязана к trip
     * (matched/en_route) — пуш водителю, освобождаем место. В trip
     * остаются другие пассажиры, но он становится unfilled. Для MVP
     * trip продолжает действовать; водитель решает ехать или нет.
     */
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

        if ($tripId !== null) {
            $trip = IntercityTrip::find($tripId);
            if ($trip !== null) {
                DB::afterCommit(function () use ($trip) {
                    $this->notifyDriverPassengerCancelled($trip);
                });
            }
        }

        return $booking->fresh();
    }

    /**
     * Активные водители в from_region маршрута, которые могут получить
     * offer. Фильтрация по is_online — водитель online, не в активном
     * заказе межгорода (один трип за раз).
     *
     * @return Collection<int, User>
     */
    private function availableDriversInRegion(IntercityRoute $route): Collection
    {
        return User::query()
            ->whereHas('driverProfile', function ($q) {
                $q->where('is_online', true)
                    ->whereNull('blocked_until');
            })
            ->whereDoesntHave('intercityDriverTrips', function ($q) {
                $q->whereIn('status', [
                    IntercityTripStatus::Matched,
                    IntercityTripStatus::EnRoute,
                ]);
            })
            ->get();
    }

    private function broadcastBatchReadyToDrivers(IntercityRoute $route, Carbon $departureDate): void
    {
        $route->loadMissing(['fromRegion', 'toRegion']);
        $drivers = $this->availableDriversInRegion($route);

        $body = "{$route->fromRegion->name} → {$route->toRegion->name} · "
            ."{$route->max_seats} мест · "
            .number_format($route->price_per_seat * $route->max_seats)
            .' сом всего · '.$departureDate->format('d.m');

        foreach ($drivers as $driver) {
            $this->pushService->sendOfferToDriver(
                $driver,
                'Межгород: пассажиры собраны',
                $body,
                [
                    'type' => 'intercity_batch_ready',
                    'route_id' => $route->id,
                    'departure_date' => $departureDate->toDateString(),
                ],
            );
        }
    }

    private function notifyPassengersTripMatched(IntercityTrip $trip): void
    {
        $trip->loadMissing(['bookings.client', 'route.fromRegion', 'route.toRegion']);
        $body = "{$trip->driver_name} ({$trip->car_model} {$trip->car_number}) "
            ."везёт вас {$trip->route->fromRegion->name} → {$trip->route->toRegion->name}";

        foreach ($trip->bookings as $booking) {
            if ($booking->client === null) {
                continue;
            }
            $this->pushService->sendOfferToDriver(
                $booking->client,
                'Водитель найден!',
                $body,
                [
                    'type' => 'intercity_matched',
                    'trip_id' => $trip->id,
                    'booking_id' => $booking->id,
                ],
            );
        }
    }

    private function notifyPassengersDriverEnRoute(IntercityTrip $trip): void
    {
        $trip->loadMissing(['bookings.client']);
        foreach ($trip->bookings as $booking) {
            if ($booking->client === null) {
                continue;
            }
            $this->pushService->sendOfferToDriver(
                $booking->client,
                'Водитель выехал',
                "{$trip->driver_name} едет за вами. {$trip->car_model} {$trip->car_number}",
                [
                    'type' => 'intercity_en_route',
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
        $this->pushService->sendOfferToDriver(
            $driver,
            'Пассажир отменил бронь',
            "В рейсе {$trip->route->fromRegion->name} → {$trip->route->toRegion->name} освободилось место",
            [
                'type' => 'intercity_passenger_cancelled',
                'trip_id' => $trip->id,
            ],
        );
    }
}
