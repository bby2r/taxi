@extends('layouts.admin')

@section('title', 'Главная')
@section('heading', 'Главная')

@section('content')
    {{-- Operational health (right now) --}}
    <h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Сейчас</h2>
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {{-- Active Orders --}}
        <div class="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div>
                <p class="text-sm text-gray-500">Активные заказы</p>
                <p class="mt-1 text-3xl font-bold text-gray-900">{{ $activeOrders }}</p>
                <p class="mt-1 text-xs text-gray-500">из них в поиске: {{ $searchingNow }}</p>
            </div>
            <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
            </div>
        </div>

        {{-- Live Drivers --}}
        <div class="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div>
                <p class="text-sm text-gray-500">Водители на линии</p>
                <p class="mt-1 text-3xl font-bold text-gray-900">{{ $liveDrivers }}</p>
                <p class="mt-1 text-xs text-gray-500">пинг за последние {{ $heartbeatSeconds }} с</p>
            </div>
            <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
            </div>
        </div>

        {{-- Stale Drivers — flagged when non-zero (OEM-killed apps) --}}
        <div class="flex items-center justify-between rounded-xl border @if ($staleDrivers > 0) border-amber-300 bg-amber-50 @else border-gray-200 bg-white @endif p-6 shadow-sm">
            <div>
                <p class="text-sm @if ($staleDrivers > 0) text-amber-700 @else text-gray-500 @endif">Заглохшие (Stale)</p>
                <p class="mt-1 text-3xl font-bold @if ($staleDrivers > 0) text-amber-700 @else text-gray-900 @endif">{{ $staleDrivers }}</p>
                <p class="mt-1 text-xs @if ($staleDrivers > 0) text-amber-600 @else text-gray-500 @endif">флаг online, но нет пинга</p>
            </div>
            <div class="flex h-12 w-12 items-center justify-center rounded-lg @if ($staleDrivers > 0) bg-amber-200 text-amber-700 @else bg-gray-100 text-gray-500 @endif">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
            </div>
        </div>

        {{-- Today Revenue --}}
        <div class="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div>
                <p class="text-sm text-gray-500">Выручка сегодня</p>
                <p class="mt-1 text-3xl font-bold text-gray-900">{{ number_format($todayRevenue) }} сом</p>
                <p class="mt-1 text-xs text-gray-500">по завершённым заказам</p>
            </div>
            <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                </svg>
            </div>
        </div>
    </div>

    {{-- Today funnel --}}
    <h2 class="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-gray-500">Сегодня</h2>
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p class="text-sm text-gray-500">Всего заказов</p>
            <p class="mt-1 text-3xl font-bold text-gray-900">{{ $ordersToday }}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p class="text-sm text-gray-500">Завершено</p>
            <p class="mt-1 text-3xl font-bold text-emerald-600">{{ $completedToday }}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p class="text-sm text-gray-500">Отменено</p>
            <p class="mt-1 text-3xl font-bold text-gray-700">{{ $cancelledToday }}</p>
        </div>
        <div class="rounded-xl border @if ($declineRateToday >= 40) border-red-300 bg-red-50 @else border-gray-200 bg-white @endif p-6 shadow-sm">
            <p class="text-sm @if ($declineRateToday >= 40) text-red-700 @else text-gray-500 @endif">Доля отказов</p>
            <p class="mt-1 text-3xl font-bold @if ($declineRateToday >= 40) text-red-700 @else text-gray-900 @endif">{{ $declineRateToday }}%</p>
            <p class="mt-1 text-xs @if ($declineRateToday >= 40) text-red-600 @else text-gray-500 @endif">{{ $declinesToday }} отказов сегодня</p>
        </div>
    </div>

    {{-- Hourly chart + top decliners --}}
    <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {{-- Orders by hour today --}}
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h3 class="mb-4 text-base font-semibold text-gray-900">Заказы по часам (сегодня)</h3>
            <div class="flex h-40 items-end gap-1">
                @foreach ($hourly as $bucket)
                    <div class="group relative flex flex-1 flex-col items-center">
                        <div
                            class="w-full rounded-t bg-amber-400 transition group-hover:bg-amber-500"
                            style="height: {{ $bucket['count'] > 0 ? max(2, intval(($bucket['count'] / $hourlyMax) * 100)) : 0 }}%"
                            title="{{ sprintf('%02d', $bucket['hour']) }}:00 — {{ $bucket['count'] }} заказ(ов)"
                        ></div>
                    </div>
                @endforeach
            </div>
            <div class="mt-2 flex justify-between text-[10px] text-gray-400">
                <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
            </div>
        </div>

        {{-- Top declining drivers today --}}
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 class="mb-4 text-base font-semibold text-gray-900">Топ-5 отказников сегодня</h3>
            @if ($topDecliners->isEmpty())
                <p class="py-8 text-center text-sm text-gray-500">Отказов нет.</p>
            @else
                <ul class="divide-y divide-gray-100">
                    @foreach ($topDecliners as $row)
                        <li class="flex items-center justify-between py-2.5">
                            <div>
                                <p class="text-sm font-medium text-gray-900">{{ $row->driver?->name ?? '—' }}</p>
                                <p class="text-xs text-gray-500">{{ $row->last_reason }}</p>
                            </div>
                            <span class="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">{{ $row->decline_count }}</span>
                        </li>
                    @endforeach
                </ul>
            @endif
        </div>
    </div>

    {{-- Billing (commission roll-up) --}}
    <h2 class="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-gray-500">
        Биллинг ({{ $commissionRate }}% с заказа)
    </h2>
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p class="text-sm text-gray-500">Комиссия за неделю</p>
            <p class="mt-1 text-3xl font-bold text-gray-900">{{ number_format($commissionThisWeek) }} сом</p>
            <p class="mt-1 text-xs text-gray-500">с понедельника по сегодня</p>
        </div>
        <div class="rounded-xl border @if ($pendingBalance > 0) border-blue-200 bg-blue-50 @else border-gray-200 bg-white @endif p-6 shadow-sm">
            <p class="text-sm @if ($pendingBalance > 0) text-blue-700 @else text-gray-500 @endif">Задолжали водители</p>
            <p class="mt-1 text-3xl font-bold @if ($pendingBalance > 0) text-blue-700 @else text-gray-900 @endif">{{ number_format($pendingBalance) }} сом</p>
            <p class="mt-1 text-xs @if ($pendingBalance > 0) text-blue-600 @else text-gray-500 @endif">сумма к получению</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div class="flex items-start justify-between">
                <div>
                    <p class="text-sm text-gray-500">Водителей с долгом</p>
                    <p class="mt-1 text-3xl font-bold text-gray-900">{{ $driversWithDebt }}</p>
                </div>
                <a href="{{ route('admin.billing.index') }}" class="text-sm font-medium text-amber-600 hover:text-amber-700">Открыть →</a>
            </div>
        </div>
    </div>

    {{-- All-time --}}
    <h2 class="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-gray-500">За всё время</h2>
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div class="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div>
                <p class="text-sm text-gray-500">Завершённых поездок</p>
                <p class="mt-1 text-3xl font-bold text-gray-900">{{ $totalRides }}</p>
            </div>
            <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
            </div>
        </div>
    </div>

    {{-- Recent Orders --}}
    <div class="mt-8 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div class="border-b border-gray-200 px-6 py-4">
            <h3 class="text-base font-semibold text-gray-900">Последние заказы</h3>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
                <thead class="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                    <tr>
                        <th class="px-6 py-3">ID</th>
                        <th class="px-6 py-3">Клиент</th>
                        <th class="px-6 py-3">Водитель</th>
                        <th class="px-6 py-3">Статус</th>
                        <th class="px-6 py-3">Сумма</th>
                        <th class="px-6 py-3">Дата</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    @forelse ($recentOrders as $order)
                        <tr class="hover:bg-gray-50">
                            <td class="whitespace-nowrap px-6 py-4 font-medium text-gray-900">#{{ $order->id }}</td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-700">{{ $order->client?->name ?? '—' }}</td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-700">{{ $order->driver?->name ?? '—' }}</td>
                            <td class="whitespace-nowrap px-6 py-4">
                                @include('admin.partials.order-status-badge', ['status' => $order->status])
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-700">{{ number_format($order->price) }} сом</td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-500">{{ $order->created_at->format('d.m.Y H:i') }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="6" class="px-6 py-8 text-center text-gray-500">Заказов пока нет.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
@endsection
