<?php

namespace App\Http\Controllers\Admin;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\DriverSettlement;
use App\Models\Order;
use App\Models\OrderDecline;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\View\View;

class DashboardController extends Controller
{
    /**
     * Display the admin dashboard with operational health, daily funnel
     * and per-hour breakdown.
     */
    public function index(): View
    {
        $heartbeatSeconds = (int) Setting::getValue('live_heartbeat_seconds', 300);
        $liveCutoff = now()->subSeconds($heartbeatSeconds);

        // Operational health (right now).
        $activeOrders = Order::whereIn('status', [
            OrderStatus::Searching,
            OrderStatus::Accepted,
            OrderStatus::Arrived,
            OrderStatus::InProgress,
        ])->count();

        $searchingNow = Order::where('status', OrderStatus::Searching)->count();

        $onlineDriversBase = User::where('role', UserRole::Driver)
            ->whereHas('driverProfile', fn ($q) => $q->where('is_online', true));

        $liveDrivers = (clone $onlineDriversBase)
            ->whereHas('driverProfile', fn ($q) => $q->where('location_updated_at', '>=', $liveCutoff))
            ->count();

        $staleDrivers = (clone $onlineDriversBase)
            ->whereHas('driverProfile', function ($q) use ($liveCutoff) {
                $q->where(fn ($q2) => $q2->where('location_updated_at', '<', $liveCutoff)
                    ->orWhereNull('location_updated_at'));
            })
            ->count();

        // Today funnel — each KPI uses the event-time field that matches
        // its meaning (revenue counts rides finished today, not placed
        // today; cancelled count uses cancellation moment; etc.).
        $ordersToday = Order::whereDate('created_at', today())->count();
        $completedToday = Order::where('status', OrderStatus::Completed)
            ->whereDate('completed_at', today())
            ->count();
        $cancelledToday = Order::where('status', OrderStatus::Cancelled)
            ->whereDate('cancelled_at', today())
            ->count();

        $todayRevenue = Order::where('status', OrderStatus::Completed)
            ->whereDate('completed_at', today())
            ->sum('price');

        // Decline rate today = declines / (declines + accepted-today).
        // "Accepted-today" uses accepted_at so a late-night decline on
        // yesterday's offer doesn't inflate today's ratio.
        $declinesToday = OrderDecline::whereDate('created_at', today())->count();
        $acceptedToday = Order::whereDate('accepted_at', today())->count();
        $totalDecisionsToday = $declinesToday + $acceptedToday;
        $declineRateToday = $totalDecisionsToday > 0
            ? round(($declinesToday / $totalDecisionsToday) * 100)
            : 0;

        $totalRides = Order::where('status', OrderStatus::Completed)->count();

        // Per-hour bar chart data — 24 buckets for today.
        $hourlyRaw = Order::whereDate('created_at', today())
            ->selectRaw('EXTRACT(HOUR FROM created_at) as h, COUNT(*) as c')
            ->groupBy('h')
            ->pluck('c', 'h')
            ->toArray();
        $hourly = collect(range(0, 23))->map(fn ($h) => [
            'hour' => $h,
            'count' => (int) ($hourlyRaw[$h] ?? 0),
        ]);
        $hourlyMax = max(1, $hourly->max('count'));

        // Top 5 declining drivers today — early-warning for abusers.
        $topDecliners = OrderDecline::with('driver')
            ->whereDate('created_at', today())
            ->selectRaw('driver_id, COUNT(*) as decline_count, MAX(reason) as last_reason')
            ->groupBy('driver_id')
            ->orderByDesc('decline_count')
            ->take(5)
            ->get();

        // Billing roll-up — surfaces what /admin/billing shows in detail.
        // Commission rate is for the header label; actual numbers come from
        // commission_amount that was locked onto orders at completion time.
        $commissionRate = (int) Setting::getValue('commission_rate', 7);
        $weekStart = Carbon::now()->startOfWeek();
        $commissionThisWeek = (int) Order::where('status', OrderStatus::Completed)
            ->where('completed_at', '>=', $weekStart)
            ->sum('commission_amount');
        $totalCommissionAccrued = (int) Order::where('status', OrderStatus::Completed)
            ->sum('commission_amount');
        $totalSettled = (int) DriverSettlement::sum('amount');
        $pendingBalance = max(0, $totalCommissionAccrued - $totalSettled);
        // Drivers-with-debt — two grouped queries instead of N per-driver
        // ones. Joined in PHP so we don't have to model commission_amount
        // and settlements in a single SQL union.
        $accruedByDriver = Order::where('status', OrderStatus::Completed)
            ->whereNotNull('driver_id')
            ->groupBy('driver_id')
            ->selectRaw('driver_id, sum(commission_amount) as total')
            ->pluck('total', 'driver_id');
        $settledByDriver = DriverSettlement::groupBy('driver_id')
            ->selectRaw('driver_id, sum(amount) as total')
            ->pluck('total', 'driver_id');
        $driversWithDebt = $accruedByDriver
            ->filter(fn ($accrued, $driverId) => ((int) $accrued - (int) ($settledByDriver[$driverId] ?? 0)) > 0)
            ->count();

        $recentOrders = Order::with(['client', 'driver'])
            ->latest()
            ->take(10)
            ->get();

        return view('admin.dashboard', compact(
            'activeOrders',
            'searchingNow',
            'liveDrivers',
            'staleDrivers',
            'heartbeatSeconds',
            'ordersToday',
            'completedToday',
            'cancelledToday',
            'todayRevenue',
            'declinesToday',
            'declineRateToday',
            'totalRides',
            'commissionRate',
            'commissionThisWeek',
            'pendingBalance',
            'driversWithDebt',
            'hourly',
            'hourlyMax',
            'topDecliners',
            'recentOrders',
        ));
    }
}
