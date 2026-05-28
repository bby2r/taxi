<?php

namespace App\Enums;

enum IntercityTripStatus: string
{
    case Matched = 'matched';
    case EnRoute = 'en_route';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    public function isActive(): bool
    {
        return in_array($this, self::activeStatuses(), true);
    }

    /**
     * @return list<self>
     */
    public static function activeStatuses(): array
    {
        return [self::Matched, self::EnRoute];
    }
}
