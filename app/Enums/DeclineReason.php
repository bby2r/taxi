<?php

namespace App\Enums;

enum DeclineReason: string
{
    case TooFar = 'too_far';
    case WrongDistrict = 'wrong_district';
    case ClientNoAnswer = 'client_no_answer';
    case Personal = 'personal';
    case Timeout = 'timeout';

    /**
     * Reasons that drivers can select from the UI.
     *
     * @return array<int, string>
     */
    public static function selectable(): array
    {
        return [
            self::TooFar->value,
            self::WrongDistrict->value,
            self::ClientNoAnswer->value,
            self::Personal->value,
        ];
    }
}
