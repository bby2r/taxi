<?php

namespace App\Enums;

enum IntercityTripStatus: string
{
    // Slot создан (cron'ом по расписанию или вручную в админке),
    // водитель ещё не claim'нул. Видимо клиентам — они могут бронить
    // места в надежде что водитель возьмёт.
    case Open = 'open';

    // Водитель claim'нул slot — он отвечает за рейс.
    case Claimed = 'claimed';

    // Все места заняты (или driver закрыл вручную). Готов к выезду.
    case Ready = 'ready';

    // Driver выехал за пассажирами.
    case EnRoute = 'en_route';

    case Completed = 'completed';

    case Cancelled = 'cancelled';

    public function isActive(): bool
    {
        return in_array($this, self::activeStatuses(), true);
    }

    /**
     * Статусы при которых slot ещё «живой» — клиент видит, водитель
     * может управлять.
     *
     * @return list<self>
     */
    public static function activeStatuses(): array
    {
        return [self::Open, self::Claimed, self::Ready, self::EnRoute];
    }

    /**
     * Статусы в которых пассажир может ещё забронировать место.
     *
     * @return list<self>
     */
    public static function bookableStatuses(): array
    {
        return [self::Open, self::Claimed];
    }
}
