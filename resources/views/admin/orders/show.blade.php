@extends('layouts.admin')

@section('title', 'Заказ #' . $order->id)
@section('heading', 'Заказ #' . $order->id)

@section('content')
    {{-- Back Link --}}
    <div class="mb-6">
        <a href="{{ route('admin.orders.index') }}" class="text-sm font-medium text-gray-500 hover:text-gray-700">
            &larr; Назад к заказам
        </a>
    </div>

    {{-- Flash messages from cancel action --}}
    @if (session('success'))
        <div class="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {{ session('success') }}
        </div>
    @endif
    @if (session('error'))
        <div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {{ session('error') }}
        </div>
    @endif

    {{-- Status & Price --}}
    <div class="mb-6 flex items-center justify-between gap-4">
        @include('admin.partials.order-status-badge', ['status' => $order->status])
        <div class="flex items-center gap-4">
            @php
                $canAdminCancel = in_array($order->status, [
                    \App\Enums\OrderStatus::Searching,
                    \App\Enums\OrderStatus::Accepted,
                    \App\Enums\OrderStatus::Arrived,
                    \App\Enums\OrderStatus::InProgress,
                ]);
            @endphp
            @if ($canAdminCancel)
                <form
                    method="POST"
                    action="{{ route('admin.orders.cancel', $order) }}"
                    onsubmit="return confirm('Точно отменить заказ #{{ $order->id }}? Действие необратимо. Клиент и водитель получат push.');"
                >
                    @csrf
                    <input
                        type="text"
                        name="reason"
                        maxlength="500"
                        placeholder="Причина (опц.)"
                        class="mr-2 w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                    <button
                        type="submit"
                        class="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
                    >
                        Отменить заказ
                    </button>
                </form>
            @endif
            <span class="text-2xl font-bold text-gray-900">{{ number_format($order->price) }} сом</span>
        </div>
    </div>

    {{-- Client & Driver Cards --}}
    <div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        @php
            // Live relation wins (current accurate data), falls back to
            // the snapshot taken at order creation / accept so history
            // survives a user delete or a driver editing their profile.
            $clientName = $order->client?->name ?? ($order->client_snapshot['name'] ?? null);
            $clientPhone = $order->client?->phone ?? ($order->client_snapshot['phone'] ?? null);
            $driverName = $order->driver?->name ?? ($order->driver_snapshot['name'] ?? null);
            $driverPhone = $order->driver?->phone ?? ($order->driver_snapshot['phone'] ?? null);
            $driverCar = $order->driver?->driverProfile?->car_model ?? ($order->driver_snapshot['car_model'] ?? null);
            $driverPlate = $order->driver?->driverProfile?->car_number ?? ($order->driver_snapshot['car_number'] ?? null);
            $clientDeleted = $order->client === null && $order->client_snapshot !== null;
            $driverDeleted = $order->driver === null && $order->driver_snapshot !== null;
        @endphp

        {{-- Client Card --}}
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 class="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Клиент
                @if ($clientDeleted)
                    <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium normal-case text-amber-700">удалён — снимок</span>
                @endif
            </h3>
            <dl class="space-y-3">
                <div>
                    <dt class="text-xs text-gray-500">Имя</dt>
                    <dd class="text-sm font-medium text-gray-900">{{ $clientName ?? '—' }}</dd>
                </div>
                <div>
                    <dt class="text-xs text-gray-500">Телефон</dt>
                    <dd class="text-sm text-gray-700">{{ $clientPhone ?? '—' }}</dd>
                </div>
            </dl>
        </div>

        {{-- Driver Card --}}
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 class="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Водитель
                @if ($driverDeleted)
                    <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium normal-case text-amber-700">удалён — снимок</span>
                @endif
            </h3>
            <dl class="space-y-3">
                <div>
                    <dt class="text-xs text-gray-500">Имя</dt>
                    <dd class="text-sm font-medium text-gray-900">{{ $driverName ?? '—' }}</dd>
                </div>
                <div>
                    <dt class="text-xs text-gray-500">Телефон</dt>
                    <dd class="text-sm text-gray-700">{{ $driverPhone ?? '—' }}</dd>
                </div>
                <div>
                    <dt class="text-xs text-gray-500">Авто</dt>
                    <dd class="text-sm text-gray-700">{{ $driverCar ?? '—' }}</dd>
                </div>
                <div>
                    <dt class="text-xs text-gray-500">Номер авто</dt>
                    <dd class="text-sm text-gray-700">{{ $driverPlate ?? '—' }}</dd>
                </div>
            </dl>
        </div>
    </div>

    {{-- Order Details Card --}}
    <div class="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Детали заказа</h3>
        <dl class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
                <dt class="text-xs text-gray-500">Адрес подачи</dt>
                <dd class="text-sm text-gray-700">{{ $order->pickup_address ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Куда</dt>
                <dd class="text-sm text-gray-700">{{ $order->dropoff_address ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Координаты подачи</dt>
                <dd class="text-sm text-gray-700">{{ $order->pickup_latitude }}, {{ $order->pickup_longitude }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Координаты назначения</dt>
                <dd class="text-sm text-gray-700">
                    @if ($order->dropoff_latitude && $order->dropoff_longitude)
                        {{ $order->dropoff_latitude }}, {{ $order->dropoff_longitude }}
                    @else
                        —
                    @endif
                </dd>
            </div>
        </dl>
    </div>

    {{-- Timeline Card --}}
    <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Хронология</h3>
        <dl class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
                <dt class="text-xs text-gray-500">Создан</dt>
                <dd class="text-sm text-gray-700">{{ $order->created_at?->format('d.m.Y H:i:s') ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Принят</dt>
                <dd class="text-sm text-gray-700">{{ $order->accepted_at?->format('d.m.Y H:i:s') ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Расч. прибытие</dt>
                <dd class="text-sm text-gray-700">
                    {{ $order->expected_arrival_at?->format('d.m.Y H:i:s') ?? '—' }}
                    @if ($order->status === \App\Enums\OrderStatus::Accepted && $order->expected_arrival_at)
                        @php
                            $deltaSeconds = now()->diffInSeconds($order->expected_arrival_at, false);
                            $isLate = $deltaSeconds < 0;
                            $absSeconds = abs((int) $deltaSeconds);
                            $mm = intdiv($absSeconds, 60);
                            $ss = str_pad((string) ($absSeconds % 60), 2, '0', STR_PAD_LEFT);
                        @endphp
                        <span class="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold {{ $isLate ? 'animate-pulse bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600' }}">
                            {{ $isLate ? 'Опоздание ' : 'До приб. ' }}{{ $mm }}:{{ $ss }}
                        </span>
                    @endif
                </dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Водитель на месте</dt>
                <dd class="text-sm text-gray-700">{{ $order->arrived_at?->format('d.m.Y H:i:s') ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">В пути</dt>
                <dd class="text-sm text-gray-700">{{ $order->in_progress_at?->format('d.m.Y H:i:s') ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Завершён</dt>
                <dd class="text-sm text-gray-700">{{ $order->completed_at?->format('d.m.Y H:i:s') ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Отменён</dt>
                <dd class="text-sm text-gray-700">{{ $order->cancelled_at?->format('d.m.Y H:i:s') ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Последнее обновление</dt>
                <dd class="text-sm text-gray-700">{{ $order->updated_at?->format('d.m.Y H:i:s') ?? '—' }}</dd>
            </div>
        </dl>
    </div>

    {{-- Decline history — why drivers passed on this order. Useful for
         spotting mismatched offers (too_far on every driver = dispatch
         radius too wide, etc.). --}}
    @if ($order->declines->isNotEmpty())
        <div class="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Отказы ({{ $order->declines->count() }})
            </h3>
            <table class="min-w-full text-sm">
                <thead>
                    <tr class="text-left text-xs uppercase tracking-wider text-gray-500">
                        <th class="py-2 pr-4">Водитель</th>
                        <th class="py-2 pr-4">Причина</th>
                        <th class="py-2 pr-4">Когда</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($order->declines as $decline)
                        <tr class="border-t border-gray-100">
                            <td class="py-2 pr-4 text-gray-900">{{ $decline->driver?->name ?? '—' }}</td>
                            <td class="py-2 pr-4 text-gray-700">{{ $decline->reason ?? '—' }}</td>
                            <td class="py-2 pr-4 text-gray-500">{{ $decline->created_at?->format('d.m, H:i:s') ?? '—' }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    @endif
@endsection
