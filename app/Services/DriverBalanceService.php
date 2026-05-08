<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Models\DriverSettlement;
use App\Models\Order;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

class DriverBalanceService
{
    /**
     * Total commission accrued from completed orders for this driver.
     */
    public function totalCommissionAccrued(User $driver): int
    {
        return (int) Order::forDriver($driver->id)
            ->where('status', OrderStatus::Completed)
            ->sum('commission_amount');
    }

    /**
     * Total settled by the driver (cash / transfer recorded by admin).
     */
    public function totalSettled(User $driver): int
    {
        return (int) DriverSettlement::forDriver($driver->id)->sum('amount');
    }

    /**
     * What the driver currently owes the operator.
     */
    public function currentBalance(User $driver): int
    {
        return $this->totalCommissionAccrued($driver) - $this->totalSettled($driver);
    }

    /**
     * Earnings + commission breakdown for a single time window. Numbers are
     * computed from `commission_amount` already stored on completed orders,
     * so changing the global commission rate later doesn't move history.
     *
     * @return array{orders: int, earnings: int, commission: int}
     */
    public function earningsForPeriod(User $driver, CarbonInterface $from, ?CarbonInterface $to = null): array
    {
        $query = Order::forDriver($driver->id)
            ->where('status', OrderStatus::Completed)
            ->where('completed_at', '>=', $from);

        if ($to) {
            $query->where('completed_at', '<', $to);
        }

        $row = $query->selectRaw(
            'count(*) as orders, coalesce(sum(price), 0) as earnings, coalesce(sum(commission_amount), 0) as commission'
        )->first();

        return [
            'orders' => (int) $row->orders,
            'earnings' => (int) $row->earnings,
            'commission' => (int) $row->commission,
        ];
    }

    /**
     * Today / week / month / total breakdown plus current owed balance and
     * the most recent settlements. Used by both driver mobile and admin.
     *
     * @return array{
     *     today: array{orders:int,earnings:int,commission:int},
     *     week: array{orders:int,earnings:int,commission:int},
     *     month: array{orders:int,earnings:int,commission:int},
     *     total: array{orders:int,earnings:int,commission:int},
     *     balance: int,
     *     last_settlement_at: ?string,
     *     recent_settlements: array<int, array{id:int,amount:int,paid_at:string,notes:?string}>
     * }
     */
    public function summary(User $driver): array
    {
        $todayStart = Carbon::today();
        $weekStart = Carbon::now()->startOfWeek();
        $monthStart = Carbon::now()->startOfMonth();

        $today = $this->earningsForPeriod($driver, $todayStart);
        $week = $this->earningsForPeriod($driver, $weekStart);
        $month = $this->earningsForPeriod($driver, $monthStart);
        $total = [
            'orders' => (int) Order::forDriver($driver->id)
                ->where('status', OrderStatus::Completed)
                ->count(),
            'earnings' => (int) Order::forDriver($driver->id)
                ->where('status', OrderStatus::Completed)
                ->sum('price'),
            'commission' => $this->totalCommissionAccrued($driver),
        ];

        $balance = $total['commission'] - $this->totalSettled($driver);

        $recent = DriverSettlement::forDriver($driver->id)
            ->orderByDesc('paid_at')
            ->limit(5)
            ->get();

        return [
            'today' => $today,
            'week' => $week,
            'month' => $month,
            'total' => $total,
            'balance' => $balance,
            'last_settlement_at' => $recent->first()?->paid_at?->toISOString(),
            'recent_settlements' => $recent->map(fn (DriverSettlement $s) => [
                'id' => $s->id,
                'amount' => $s->amount,
                'paid_at' => $s->paid_at->toISOString(),
                'notes' => $s->notes,
            ])->all(),
        ];
    }

    /**
     * Record that the driver paid (cash / transfer) the given amount toward
     * their commission balance. Returns the persisted settlement.
     */
    public function recordSettlement(
        User $driver,
        int $amount,
        User $admin,
        ?string $notes = null,
        ?CarbonInterface $paidAt = null,
    ): DriverSettlement {
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Settlement amount must be positive.');
        }

        return DriverSettlement::create([
            'driver_id' => $driver->id,
            'recorded_by' => $admin->id,
            'amount' => $amount,
            'notes' => $notes,
            'paid_at' => $paidAt ?? now(),
        ]);
    }
}
