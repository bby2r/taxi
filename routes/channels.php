<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('client.{userId}', function (User $user, int $userId): bool {
    return $user->id === $userId;
});

Broadcast::channel('driver.{userId}', function (User $user, int $userId): bool {
    return $user->id === $userId && $user->isDriver();
});
