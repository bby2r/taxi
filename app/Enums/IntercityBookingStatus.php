<?php

namespace App\Enums;

enum IntercityBookingStatus: string
{
    case Pending = 'pending';
    case Matched = 'matched';
    case EnRoute = 'en_route';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
    case NoShow = 'no_show';

    public function isActive(): bool
    {
        return in_array($this, self::activeStatuses(), true);
    }

    /**
     * @return list<self>
     */
    public static function activeStatuses(): array
    {
        return [self::Pending, self::Matched, self::EnRoute];
    }
}
