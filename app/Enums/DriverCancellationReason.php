<?php

namespace App\Enums;

enum DriverCancellationReason: string
{
    case ClientNoShow = 'client_no_show';
    case ClientNoAnswer = 'client_no_answer';
    case LongWait = 'long_wait';

    /**
     * Reasons drivers can pick from the UI when cancelling an active order.
     *
     * @return array<int, string>
     */
    public static function selectable(): array
    {
        return [
            self::ClientNoShow->value,
            self::ClientNoAnswer->value,
            self::LongWait->value,
        ];
    }
}
