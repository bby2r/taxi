<?php

namespace App\Http\Controllers\Admin;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class OrderController extends Controller
{
    public function __construct(private readonly OrderService $orderService) {}

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

    /**
     * Force-cancel an active order from the admin panel. Override for
     * stuck/abandoned rides (driver исчез, mosh клиент, и т.п.). Бьёт
     * через OrderService::cancelOrder с $force=true — единственное
     * место в коде, где разрешена отмена in_progress.
     *
     * Завершённые и уже отменённые заказы не трогаем — кнопка в Blade
     * скрыта для них, но повторный POST уйдёт с 422 через сервис.
     */
    public function cancel(Request $request, Order $order): RedirectResponse
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        try {
            $this->orderService->cancelOrder(
                $order,
                'admin',
                $validated['reason'] ?? null,
                force: true,
            );
        } catch (\RuntimeException $e) {
            return redirect()
                ->route('admin.orders.show', $order)
                ->with('error', $e->getMessage());
        }

        return redirect()
            ->route('admin.orders.show', $order)
            ->with('success', 'Заказ отменён.');
    }
}
