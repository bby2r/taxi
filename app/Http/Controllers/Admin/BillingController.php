<?php

namespace App\Http\Controllers\Admin;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\User;
use App\Services\DriverBalanceService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class BillingController extends Controller
{
    public function __construct(private readonly DriverBalanceService $balanceService) {}

    /**
     * Per-driver balance overview for the operator. Drivers with the
     * highest outstanding amount come first.
     */
    public function index(Request $request): View
    {
        $drivers = User::query()
            ->where('role', UserRole::Driver)
            ->orderBy('name')
            ->get();

        $rows = $drivers->map(function (User $driver) {
            $weekStart = Carbon::now()->startOfWeek();
            $weekStats = $this->balanceService->earningsForPeriod($driver, $weekStart);

            return [
                'driver' => $driver,
                'week_orders' => $weekStats['orders'],
                'week_earnings' => $weekStats['earnings'],
                'week_commission' => $weekStats['commission'],
                'balance' => $this->balanceService->currentBalance($driver),
            ];
        })->sortByDesc('balance')->values();

        $totals = [
            'pending' => $rows->sum('balance'),
            'week_commission' => $rows->sum('week_commission'),
            'drivers_with_debt' => $rows->where('balance', '>', 0)->count(),
        ];

        return view('admin.billing.index', [
            'rows' => $rows,
            'totals' => $totals,
        ]);
    }

    /**
     * Detailed driver billing card: weekly earnings, commission ledger,
     * settlement history, plus a form to record a new payment.
     */
    public function show(User $driver): View
    {
        abort_unless($driver->role === UserRole::Driver, 404);

        $summary = $this->balanceService->summary($driver);

        $weeklyHistory = collect();
        for ($i = 0; $i < 6; $i++) {
            $start = Carbon::now()->startOfWeek()->subWeeks($i);
            $end = (clone $start)->addWeek();
            $stats = $this->balanceService->earningsForPeriod($driver, $start, $end);
            $weeklyHistory->push([
                'label' => $start->format('d M').' – '.(clone $end)->subDay()->format('d M'),
                'orders' => $stats['orders'],
                'earnings' => $stats['earnings'],
                'commission' => $stats['commission'],
            ]);
        }

        $settlements = $driver->settlements()
            ->with('recorder')
            ->orderByDesc('paid_at')
            ->paginate(15);

        $recentOrders = Order::forDriver($driver->id)
            ->where('status', OrderStatus::Completed)
            ->orderByDesc('completed_at')
            ->limit(15)
            ->get();

        return view('admin.billing.show', [
            'driver' => $driver,
            'summary' => $summary,
            'weeklyHistory' => $weeklyHistory,
            'settlements' => $settlements,
            'recentOrders' => $recentOrders,
        ]);
    }

    /**
     * Record a settlement (cash / transfer received) against the driver's
     * outstanding balance.
     */
    public function storeSettlement(Request $request, User $driver): RedirectResponse
    {
        abort_unless($driver->role === UserRole::Driver, 404);

        $validated = $request->validate([
            'amount' => ['required', 'integer', 'min:1', 'max:1000000'],
            'notes' => ['nullable', 'string', 'max:255'],
            'paid_at' => ['nullable', 'date'],
        ]);

        $this->balanceService->recordSettlement(
            $driver,
            (int) $validated['amount'],
            $request->user(),
            $validated['notes'] ?? null,
            isset($validated['paid_at']) ? Carbon::parse($validated['paid_at']) : null,
        );

        return redirect()
            ->route('admin.billing.show', $driver)
            ->with('status', 'Платёж зафиксирован.');
    }
}
