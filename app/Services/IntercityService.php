<?php

namespace App\Services;

use App\Enums\IntercityBookingStatus;
use App\Enums\IntercityTripStatus;
use App\Models\IntercityBooking;
use App\Models\IntercityRoute;
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

    /**
     * Создаёт pending-бронь клиента на route+date+seats. Когда набирается
     * max_seats — рассылает offer водителям в from_region.
     *
     * @throws RuntimeException если активная бронь уже есть, маршрут
     *                          неактивен или мест недостаточно
     */
    public function createBooking(
        User $client,
        IntercityRoute $route,
        Carbon $departureDate,
        int $seatsCount,
        ?string $pickupAddress = null,
    ): IntercityBooking {
        if (! $route->is_active) {
            throw new RuntimeException('Этот маршрут больше не доступен.');
        }

        $existing = IntercityBooking::query()
            ->where('client_id', $client->id)
            ->active()
            ->first();
        if ($existing !== null) {
            throw new RuntimeException('У вас уже есть активная бронь межгорода.');
        }

        return DB::transaction(function () use ($client, $route, $departureDate, $seatsCount, $pickupAddress) {
            // lockForUpdate — пара клиентов одновременно занимающие
            // последние места не должны overcommit'нуть batch.
            $occupied = IntercityBooking::query()
                ->where('route_id', $route->id)
                ->whereDate('departure_date', $departureDate)
                ->whereIn('status', IntercityBookingStatus::activeStatuses())
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
     * Водитель принимает batch — создаёт trip, FIFO привязывает старейшие
     * pending bookings до max_seats. Меньше — throw (кто-то отменил пока
     * водитель брал).
     */
    public function acceptByDriver(
        User $driver,
        IntercityRoute $route,
        Carbon $departureDate,
    ): IntercityTrip {
        $driver->loadMissing('driverProfile');

        return DB::transaction(function () use ($driver, $route, $departureDate) {
            $pendingBookings = IntercityBooking::query()
                ->where('route_id', $route->id)
                ->whereDate('departure_date', $departureDate)
                ->where('status', IntercityBookingStatus::Pending)
                ->orderBy('created_at')
                ->lockForUpdate()
                ->get();

            // FIFO: набираем пока не превысим max_seats. Остаток
            // (если кто-то взял больше мест чем влезло) остаётся
            // pending для следующего batch.
            $acceptedIds = [];
            $totalSeats = 0;
            foreach ($pendingBookings as $b) {
                if ($totalSeats + $b->seats_count <= $route->max_seats) {
                    $acceptedIds[] = $b->id;
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

            IntercityBooking::whereIn('id', $acceptedIds)->update([
                'trip_id' => $trip->id,
                'status' => IntercityBookingStatus::Matched,
                'matched_at' => now(),
            ]);

            DB::afterCommit(function () use ($trip) {
                $this->notifyPassengersTripMatched($trip);
            });

            return $trip->fresh(['bookings']);
        });
    }

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
     * Клиент отменяет бронь. Если уже matched к trip — водитель
     * получает пуш «освободилось место»; trip продолжает действовать
     * с меньшим числом пассажиров (для MVP).
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
                DB::afterCommit(fn () => $this->notifyDriverPassengerCancelled($trip));
            }
        }

        return $booking->fresh();
    }

    /**
     * Активные водители в зоне обслуживания from_region маршрута —
     * GPS-фильтр через GeoService (radius=detection_max_km). Те же
     * критерии что для обычных заказов (online, не заблокированы,
     * не в активном межгород-трипе).
     *
     * @return Collection<int, User>
     */
    private function availableDriversInRegion(IntercityRoute $route): Collection
    {
        $route->loadMissing('fromRegion');
        $from = $route->fromRegion;
        if ($from === null || $from->center_latitude === null || $from->center_longitude === null) {
            // Регион без координат — fallback к старому поведению
            // (все online водители без активного межгород-трипа).
            return User::query()
                ->whereHas('driverProfile', fn ($q) => $q->online()->notBlocked())
                ->whereDoesntHave('intercityDriverTrips', fn ($q) => $q->active())
                ->get();
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

        return User::query()
            ->whereIn('id', $userIds)
            ->whereDoesntHave('intercityDriverTrips', fn ($q) => $q->active())
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

        $this->notifyTripPassengers($trip, 'Водитель найден!', $body, 'intercity_matched');
    }

    private function notifyPassengersDriverEnRoute(IntercityTrip $trip): void
    {
        $trip->loadMissing('bookings.client');
        $body = "{$trip->driver_name} едет за вами. {$trip->car_model} {$trip->car_number}";

        $this->notifyTripPassengers($trip, 'Водитель выехал', $body, 'intercity_en_route');
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
            // sendToUser — обычный visible push (нечего тут озвучивать как
            // ringtone-оверлей; это пассажирские уведомления, а не offer
            // водителю). sendOfferToDriver был бы багом — TTL 30s и high
            // priority overlay не для пассажирского UX.
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
            [
                'type' => 'intercity_passenger_cancelled',
                'trip_id' => $trip->id,
            ],
        );
    }
}
