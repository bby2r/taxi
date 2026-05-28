@extends('layouts.admin')

@section('title', 'Рейс #' . $trip->id)
@section('heading', 'Рейс #' . $trip->id)

@php
    $statusLabels = [
        'open' => ['Открыт', 'bg-gray-100 text-gray-700'],
        'claimed' => ['Принят водителем', 'bg-amber-100 text-amber-700'],
        'ready' => ['Готов к выезду', 'bg-blue-100 text-blue-700'],
        'en_route' => ['В пути', 'bg-emerald-100 text-emerald-700'],
        'completed' => ['Завершён', 'bg-emerald-50 text-emerald-600'],
        'cancelled' => ['Отменён', 'bg-red-50 text-red-600'],
    ];
    [$statusLabel, $statusPillCss] = $statusLabels[$trip->status->value] ?? [$trip->status->value, 'bg-gray-100 text-gray-700'];

    $bookingStatusLabels = [
        'pending' => ['Ждёт', 'bg-gray-100 text-gray-700'],
        'matched' => ['Подтверждена', 'bg-amber-100 text-amber-700'],
        'en_route' => ['В пути', 'bg-emerald-100 text-emerald-700'],
        'completed' => ['Завершена', 'bg-emerald-50 text-emerald-600'],
        'cancelled' => ['Отменена', 'bg-red-50 text-red-600'],
        'no_show' => ['Не пришёл', 'bg-purple-100 text-purple-700'],
    ];
@endphp

@section('content')
    @include('admin.partials.flash')

    <div class="mb-4">
        <a href="{{ route('admin.intercity-trips.index') }}" class="text-sm text-gray-600 hover:text-amber-600">← К списку рейсов</a>
    </div>

    <div class="grid gap-6 lg:grid-cols-3">
        {{-- Левая колонка: маршрут + статус + кнопки админа --}}
        <div class="space-y-6 lg:col-span-1">
            <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div class="mb-2 text-xs uppercase tracking-wider text-gray-500">Маршрут</div>
                <h2 class="text-xl font-bold text-gray-900">
                    {{ $trip->route?->fromRegion?->name }} → {{ $trip->route?->toRegion?->name }}
                </h2>
                <div class="mt-3 flex flex-wrap items-center gap-2">
                    <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {{ $statusPillCss }}">
                        {{ $statusLabel }}
                    </span>
                    @if ($trip->is_closed)
                        <span class="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">слот закрыт</span>
                    @endif
                </div>

                <dl class="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <dt class="text-gray-500">Выезд</dt>
                    <dd class="font-medium text-gray-900">{{ $trip->departure_at?->timezone('Asia/Bishkek')->format('d M Y, H:i') }}</dd>

                    <dt class="text-gray-500">Мест</dt>
                    <dd class="font-medium text-gray-900">{{ $trip->seatsBooked() }} / {{ $trip->max_seats }}</dd>

                    <dt class="text-gray-500">Цена/место</dt>
                    <dd class="font-medium text-gray-900">{{ number_format($trip->price_per_seat) }} сом</dd>

                    <dt class="text-gray-500">Принят в</dt>
                    <dd class="font-medium text-gray-900">{{ $trip->accepted_at?->timezone('Asia/Bishkek')->format('d M, H:i') ?? '—' }}</dd>

                    <dt class="text-gray-500">Выехал в</dt>
                    <dd class="font-medium text-gray-900">{{ $trip->departed_at?->timezone('Asia/Bishkek')->format('d M, H:i') ?? '—' }}</dd>

                    <dt class="text-gray-500">Завершён</dt>
                    <dd class="font-medium text-gray-900">{{ $trip->completed_at?->timezone('Asia/Bishkek')->format('d M, H:i') ?? '—' }}</dd>

                    @if ($trip->cancelled_at)
                        <dt class="text-gray-500">Отменён</dt>
                        <dd class="font-medium text-gray-900">
                            {{ $trip->cancelled_at->timezone('Asia/Bishkek')->format('d M, H:i') }}
                            @if ($trip->cancelled_by)
                                <span class="text-xs text-gray-500">({{ $trip->cancelled_by }})</span>
                            @endif
                        </dd>
                    @endif
                </dl>
            </div>

            @if (in_array($trip->status->value, ['claimed','ready','en_route'], true))
                <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h3 class="mb-3 text-base font-semibold text-gray-900">Действия диспетчера</h3>
                    <p class="mb-4 text-xs text-gray-500">
                        Закрыть = заблокировать новые брони. Отменить = разорвать рейс
                        (пассажирам уйдёт push, бронь становится «отменена»).
                    </p>
                    @if (in_array($trip->status->value, ['claimed','ready'], true) && ! $trip->is_closed)
                        <form method="POST" action="{{ route('admin.intercity-trips.close', $trip) }}" class="mb-3">
                            @csrf
                            <button type="submit" class="w-full rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50">
                                Закрыть слот
                            </button>
                        </form>
                    @endif
                    <form method="POST" action="{{ route('admin.intercity-trips.cancel', $trip) }}" onsubmit="return confirm('Отменить рейс? Пассажиры получат уведомление.')">
                        @csrf
                        <button type="submit" class="w-full rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                            Отменить рейс
                        </button>
                    </form>
                </div>
            @endif
        </div>

        {{-- Правая колонка: водитель + пассажиры --}}
        <div class="space-y-6 lg:col-span-2">
            <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 class="mb-4 text-base font-semibold text-gray-900">Водитель</h3>
                @if ($trip->driver)
                    <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        <dt class="text-gray-500">Имя</dt>
                        <dd class="font-medium text-gray-900">{{ $trip->driver_name ?? $trip->driver->name }}</dd>

                        <dt class="text-gray-500">Телефон</dt>
                        <dd class="font-medium text-gray-900">
                            <a href="tel:{{ $trip->driver_phone ?? $trip->driver->phone }}" class="hover:text-amber-600">
                                {{ $trip->driver_phone ?? $trip->driver->phone }}
                            </a>
                        </dd>

                        <dt class="text-gray-500">Машина</dt>
                        <dd class="font-medium text-gray-900">{{ $trip->car_model }} {{ $trip->car_number }}</dd>

                        <dt class="text-gray-500">Профиль</dt>
                        <dd>
                            <a href="{{ route('admin.drivers.edit', $trip->driver) }}" class="text-sm font-medium text-amber-600 hover:text-amber-700">
                                Открыть карточку →
                            </a>
                        </dd>
                    </dl>
                @else
                    <p class="text-sm text-gray-500">Слот ещё не принят водителем.</p>
                @endif
            </div>

            <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 class="mb-4 text-base font-semibold text-gray-900">Пассажиры ({{ $trip->bookings->count() }})</h3>
                @if ($trip->bookings->isEmpty())
                    <p class="text-sm text-gray-500">Пока никто не забронировал.</p>
                @else
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-sm">
                            <thead class="border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500">
                                <tr>
                                    <th class="py-2">Клиент</th>
                                    <th class="py-2">Телефон</th>
                                    <th class="py-2">Места</th>
                                    <th class="py-2">Откуда забрать</th>
                                    <th class="py-2">Статус</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200">
                                @foreach ($trip->bookings as $booking)
                                    @php
                                        [$bookingLabel, $bookingPill] = $bookingStatusLabels[$booking->status->value] ?? [$booking->status->value, 'bg-gray-100 text-gray-700'];
                                    @endphp
                                    <tr>
                                        <td class="py-3 font-medium text-gray-900">{{ $booking->client_name ?? $booking->client?->name }}</td>
                                        <td class="py-3 text-gray-700">
                                            <a href="tel:{{ $booking->client_phone ?? $booking->client?->phone }}" class="hover:text-amber-600">
                                                {{ $booking->client_phone ?? $booking->client?->phone }}
                                            </a>
                                        </td>
                                        <td class="py-3 text-gray-700">{{ $booking->seats_count }}</td>
                                        <td class="py-3 text-gray-700">{{ $booking->pickup_address ?? '—' }}</td>
                                        <td class="py-3">
                                            <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {{ $bookingPill }}">
                                                {{ $bookingLabel }}
                                            </span>
                                        </td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                @endif
            </div>
        </div>
    </div>
@endsection
