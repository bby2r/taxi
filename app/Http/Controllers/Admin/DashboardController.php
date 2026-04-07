<?php

namespace App\Http\Controllers\Admin;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\User;
use Illuminate\View\View;

class DashboardController extends Controller
{
    /**
     * Display the admin dashboard with key statistics and recent orders.
     */
    public function index(): View
    {
        $activeOrders = Order::whereIn('status', [
            OrderStatus::Searching,
            OrderStatus::Accepted,
            OrderStatus::Arrived,
            OrderStatus::InProgress,
        ])->count();

        $onlineDrivers = User::where('role', UserRole::Driver)
            ->whereHas('driverProfile', fn ($q) => $q->where('is_online', true))
            ->count();

        $todayRevenue = Order::where('status', OrderStatus::Completed)
            ->whereDate('updated_at', today())
            ->sum('price');

        $totalRides = Order::where('status', OrderStatus::Completed)->count();

        $recentOrders = Order::with(['client', 'driver'])
            ->latest()
            ->take(10)
            ->get();

        return view('admin.dashboard', compact(
            'activeOrders',
            'onlineDrivers',
            'todayRevenue',
            'totalRides',
            'recentOrders',
        ));
    }
}
