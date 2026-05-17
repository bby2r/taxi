<?php

namespace App\Http\Controllers\Admin;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\View\View;

class OrderController extends Controller
{
    /**
     * Display a listing of orders with optional status filter.
     */
    public function index(Request $request): View
    {
        $query = Order::with(['client', 'driver'])->latest();

        if ($request->filled('status')) {
            $status = OrderStatus::tryFrom($request->status);

            if ($status) {
                $query->where('status', $status);
            }
        }

        $orders = $query->paginate(20)->withQueryString();
        $statuses = OrderStatus::cases();

        return view('admin.orders.index', compact('orders', 'statuses'));
    }

    /**
     * Display the specified order.
     */
    public function show(Order $order): View
    {
        $order->load(['client', 'driver.driverProfile', 'declines.driver']);

        return view('admin.orders.show', compact('order'));
    }
}
