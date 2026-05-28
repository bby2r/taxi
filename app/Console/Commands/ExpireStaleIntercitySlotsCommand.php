<?php

namespace App\Console\Commands;

use App\Services\IntercityService;
use Illuminate\Console\Command;

class ExpireStaleIntercitySlotsCommand extends Command
{
    protected $signature = 'intercity:expire-stale-slots';

    protected $description = 'Отменяет slot\'ы у которых departure_at прошло >30 мин назад и водитель не выехал.';

    public function handle(IntercityService $service): int
    {
        $expired = $service->expireStaleSlots();
        $this->info("Cancelled {$expired} stale slot(s).");

        return self::SUCCESS;
    }
}
