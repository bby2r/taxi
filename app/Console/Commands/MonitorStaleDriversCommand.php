<?php

namespace App\Console\Commands;

use App\Models\DriverProfile;
use App\Models\Setting;
use App\Services\ExpoPushService;
use Illuminate\Console\Command;

class MonitorStaleDriversCommand extends Command
{
    protected $signature = 'drivers:monitor-stale';

    protected $description = 'Recover or retire drivers whose heartbeat went stale: silent wake → visible nudge → auto-offline.';

    /**
     * Three-stage escalation for online drivers whose location ping
     * stopped flowing. Runs once a minute via the scheduler.
     *
     *   1-2 min stale  → silent FCM push to wake the native ping
     *                    service (Doze recovery). No UI on device.
     *   2-10 min stale → visible "open app" nudge (silent didn't work,
     *                    probably need user interaction).
     *   >10 min stale  → auto-offline. The flag is cleared, the
     *                    driver sees "Не на линии" next time they
     *                    open the app and toggles back themselves.
     *
     * Per-stage timestamps (stale_silent_pinged_at / stale_nudge_sent_at)
     * make every escalation fire once per episode, not every minute.
     * Both are reset to NULL on go-online so the next stale period
     * starts clean.
     */
    public function handle(ExpoPushService $push): int
    {
        $heartbeat = (int) Setting::getValue('live_heartbeat_seconds', 300);

        // Three windows, escalating in patience. Tuned for the 5-min
        // default heartbeat — give silent recovery two full minutes
        // to take effect before bothering the driver with a visible
        // nudge, and 15 minutes total before assuming they're gone.
        $silentCutoff = now()->subSeconds($heartbeat);
        $nudgeCutoff = now()->subSeconds($heartbeat + 120);
        $offlineCutoff = now()->subMinutes(15);

        $silent = 0;
        $nudge = 0;
        $offline = 0;

        DriverProfile::query()
            ->where('is_online', true)
            ->whereNotNull('location_updated_at')
            ->where('location_updated_at', '<=', $silentCutoff)
            ->with('user')
            ->chunk(50, function ($profiles) use ($push, $nudgeCutoff, $offlineCutoff, &$silent, &$nudge, &$offline) {
                foreach ($profiles as $profile) {
                    $user = $profile->user;
                    if (! $user) {
                        continue;
                    }

                    // Stage 3 — auto-offline. Highest priority so a long
                    // stale episode doesn't get re-nudged before the
                    // flag flip.
                    if ($profile->location_updated_at->lte($offlineCutoff)) {
                        $profile->update([
                            'is_online' => false,
                            'stale_silent_pinged_at' => null,
                            'stale_nudge_sent_at' => null,
                        ]);
                        $offline++;

                        continue;
                    }

                    // Stage 2 — visible nudge. Only if silent already
                    // tried (so we know it didn't recover) and we
                    // haven't already nudged this episode.
                    if (
                        $profile->stale_silent_pinged_at !== null
                        && $profile->stale_nudge_sent_at === null
                        && $profile->location_updated_at->lte($nudgeCutoff)
                    ) {
                        if ($push->sendStaleNudgeToDriver($user)) {
                            $profile->update(['stale_nudge_sent_at' => now()]);
                            $nudge++;
                        }

                        continue;
                    }

                    // Stage 1 — silent wake. First attempt, no UI.
                    if ($profile->stale_silent_pinged_at === null) {
                        if ($push->sendSilentWakeToDriver($user)) {
                            $profile->update(['stale_silent_pinged_at' => now()]);
                            $silent++;
                        }
                    }
                }
            });

        $this->info("Stale monitor: silent={$silent} nudge={$nudge} offline={$offline}");

        return self::SUCCESS;
    }
}
