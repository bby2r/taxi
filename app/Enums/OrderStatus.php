<?php

namespace App\Enums;

enum OrderStatus: string
{
    case Searching = 'searching';
    case Accepted = 'accepted';
    case Arrived = 'arrived';
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
}
