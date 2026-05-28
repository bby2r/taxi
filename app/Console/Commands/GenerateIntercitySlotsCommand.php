<?php

namespace App\Console\Commands;

use App\Services\IntercityService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class GenerateIntercitySlotsCommand extends Command
{
    protected $signature = 'intercity:generate-slots {--days=2 : Generate slots N days ahead}';

    protected $description = 'Создаёт открытые межгород-slot\'ы по активным расписаниям на ближайшие дни.';

    public function handle(IntercityService $service): int
    {
        $days = (int) $this->option('days');
        $today = Carbon::now('Asia/Bishkek')->startOfDay();

        $total = 0;
        for ($i = 0; $i < $days; $i++) {
            $date = $today->copy()->addDays($i);
            $created = $service->generateSlotsForDate($date);
            $this->line(sprintf('  %s — %d slot(s) created', $date->toDateString(), $created));
            $total += $created;
        }

        $this->info("Done. Total {$total} slot(s) created.");

        return self::SUCCESS;
    }
}
