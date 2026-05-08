@extends('layouts.admin')

@section('title', 'Биллинг: ' . $driver->name)
@section('heading', 'Биллинг: ' . $driver->name)

@section('content')
    @if (session('status'))
        <div class="mb-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{{ session('status') }}</div>
    @endif

    <div class="mb-6 flex items-center gap-3">
        <a href="{{ route('admin.billing.index') }}" class="text-sm text-gray-500 hover:text-gray-700">← Все водители</a>
        <span class="text-gray-300">/</span>
        <span class="text-sm text-gray-700">{{ $driver->phone }}</span>
    </div>

    <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div class="rounded-lg bg-white p-5 shadow-sm">
            <p class="text-sm text-gray-500">Сегодня</p>
            <p class="mt-2 text-xl font-semibold text-gray-900">{{ $summary['today']['orders'] }} поездок</p>
            <p class="text-sm text-gray-600">{{ number_format($summary['today']['earnings'], 0, '.', ' ') }} сом</p>
            <p class="text-xs text-amber-600">комиссия: {{ number_format($summary['today']['commission'], 0, '.', ' ') }}</p>
        </div>
        <div class="rounded-lg bg-white p-5 shadow-sm">
            <p class="text-sm text-gray-500">Эта неделя</p>
            <p class="mt-2 text-xl font-semibold text-gray-900">{{ $summary['week']['orders'] }} поездок</p>
            <p class="text-sm text-gray-600">{{ number_format($summary['week']['earnings'], 0, '.', ' ') }} сом</p>
            <p class="text-xs text-amber-600">комиссия: {{ number_format($summary['week']['commission'], 0, '.', ' ') }}</p>
        </div>
        <div class="rounded-lg bg-white p-5 shadow-sm">
            <p class="text-sm text-gray-500">Месяц</p>
            <p class="mt-2 text-xl font-semibold text-gray-900">{{ $summary['month']['orders'] }} поездок</p>
            <p class="text-sm text-gray-600">{{ number_format($summary['month']['earnings'], 0, '.', ' ') }} сом</p>
            <p class="text-xs text-amber-600">комиссия: {{ number_format($summary['month']['commission'], 0, '.', ' ') }}</p>
        </div>
        <div class="rounded-lg p-5 shadow-sm {{ $summary['balance'] > 0 ? 'bg-red-50 text-red-900' : 'bg-emerald-50 text-emerald-900' }}">
            <p class="text-sm">Текущий долг</p>
            <p class="mt-2 text-2xl font-bold">{{ number_format($summary['balance'], 0, '.', ' ') }} сом</p>
            @if ($summary['last_settlement_at'])
                <p class="text-xs opacity-75">Последний платёж: {{ \Carbon\Carbon::parse($summary['last_settlement_at'])->format('d M Y') }}</p>
            @else
                <p class="text-xs opacity-75">Ещё не было платежей</p>
            @endif
        </div>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {{-- Settlement form + recent settlements --}}
        <div class="lg:col-span-1 space-y-6">
            <div class="rounded-lg bg-white p-5 shadow-sm">
                <h3 class="mb-4 text-base font-semibold text-gray-900">Зафиксировать платёж</h3>
                <form method="POST" action="{{ route('admin.billing.settlements.store', $driver) }}" class="space-y-3">
                    @csrf
                    <div>
                        <label class="block text-xs font-medium text-gray-600 mb-1">Сумма (сом)</label>
                        <input type="number" name="amount" min="1" required
                            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                            placeholder="0">
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-600 mb-1">Заметка</label>
                        <input type="text" name="notes" maxlength="255"
                            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                            placeholder="нал / Optima / MBank">
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-600 mb-1">Дата платежа</label>
                        <input type="datetime-local" name="paid_at"
                            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                            value="{{ now()->format('Y-m-d\TH:i') }}">
                    </div>
                    @error('amount') <p class="text-xs text-red-600">{{ $message }}</p> @enderror
                    <button type="submit" class="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600">
                        Принять платёж
                    </button>
                </form>
            </div>

            <div class="rounded-lg bg-white p-5 shadow-sm">
                <h3 class="mb-4 text-base font-semibold text-gray-900">Последние платежи</h3>
                @forelse ($settlements as $s)
                    <div class="border-b border-gray-100 py-3 text-sm last:border-b-0">
                        <div class="flex items-center justify-between">
                            <span class="font-semibold text-gray-900">{{ number_format($s->amount, 0, '.', ' ') }} сом</span>
                            <span class="text-xs text-gray-500">{{ $s->paid_at->format('d M Y, H:i') }}</span>
                        </div>
                        @if ($s->notes)
                            <p class="mt-1 text-xs text-gray-600">{{ $s->notes }}</p>
                        @endif
                        @if ($s->recorder)
                            <p class="mt-1 text-xs text-gray-400">записал: {{ $s->recorder->name }}</p>
                        @endif
                    </div>
                @empty
                    <p class="text-sm text-gray-500">Платежей ещё не было</p>
                @endforelse

                @if ($settlements->hasPages())
                    <div class="mt-4">{{ $settlements->links() }}</div>
                @endif
            </div>
        </div>

        {{-- Weekly history + recent rides --}}
        <div class="lg:col-span-2 space-y-6">
            <div class="rounded-lg bg-white p-5 shadow-sm">
                <h3 class="mb-4 text-base font-semibold text-gray-900">По неделям</h3>
                <table class="min-w-full text-sm">
                    <thead>
                        <tr class="text-left text-xs text-gray-500 uppercase">
                            <th class="pb-2">Неделя</th>
                            <th class="pb-2 text-right">Поездок</th>
                            <th class="pb-2 text-right">Заработок</th>
                            <th class="pb-2 text-right">Комиссия (7%)</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        @foreach ($weeklyHistory as $w)
                            <tr>
                                <td class="py-2">{{ $w['label'] }}</td>
                                <td class="py-2 text-right">{{ $w['orders'] }}</td>
                                <td class="py-2 text-right">{{ number_format($w['earnings'], 0, '.', ' ') }} сом</td>
                                <td class="py-2 text-right text-amber-600">{{ number_format($w['commission'], 0, '.', ' ') }} сом</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>

            <div class="rounded-lg bg-white p-5 shadow-sm">
                <h3 class="mb-4 text-base font-semibold text-gray-900">Последние 15 поездок</h3>
                @if ($recentOrders->isEmpty())
                    <p class="text-sm text-gray-500">Нет завершённых поездок</p>
                @else
                    <table class="min-w-full text-sm">
                        <thead>
                            <tr class="text-left text-xs text-gray-500 uppercase">
                                <th class="pb-2">#</th>
                                <th class="pb-2">Завершён</th>
                                <th class="pb-2 text-right">Цена</th>
                                <th class="pb-2 text-right">Комиссия</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            @foreach ($recentOrders as $order)
                                <tr>
                                    <td class="py-2">{{ $order->id }}</td>
                                    <td class="py-2 text-gray-600">{{ $order->completed_at?->format('d M Y, H:i') }}</td>
                                    <td class="py-2 text-right">{{ $order->price }} сом</td>
                                    <td class="py-2 text-right text-amber-600">{{ $order->commission_amount ?? 0 }} сом</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                @endif
            </div>
        </div>
    </div>
@endsection
