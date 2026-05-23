<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('orders:cancel-stale')
    ->everyTenMinutes()
    ->withoutOverlapping();

// Stale-driver recovery — see MonitorStaleDriversCommand for the
// three-stage escalation. Runs every minute; withoutOverlapping
// guards against a slow run getting double-fired.
Schedule::command('drivers:monitor-stale')
    ->everyMinute()
    ->withoutOverlapping();
