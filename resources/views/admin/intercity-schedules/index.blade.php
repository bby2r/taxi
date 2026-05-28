@extends('layouts.admin')

@section('title', 'Расписания межгород-рейсов')
@section('heading', 'Расписания межгород-рейсов')

@php
    $dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
@endphp

@section('content')
    <div class="mb-6 flex items-center justify-between">
        <div>
            <p class="text-sm text-gray-600">Всего: {{ $schedules->total() }} расписаний</p>
            <p class="mt-1 text-xs text-gray-500">
                Cron `intercity:generate-slots` ежедневно в 05:00 (Bishkek) создаёт slot'ы на ближайшие 2 дня из активных расписаний.
            </p>
        </div>
        <div class="flex items-center gap-3">
            <form method="POST" action="{{ route('admin.intercity-schedules.generate-now') }}">
                @csrf
                <button
                    type="submit"
                    class="inline-flex items-center gap-2 rounded-lg border border-amber-400 bg-white px-4 py-2.5 text-sm font-medium text-amber-700 shadow-sm hover:bg-amber-50"
                >
                    Сгенерировать сейчас
                </button>
            </form>
            <a
                href="{{ route('admin.intercity-schedules.create') }}"
                class="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-amber-600"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
                    <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                </svg>
                Добавить расписание
            </a>
        </div>
    </div>

    @if (session('success'))
        <div class="mb-4 rounded-lg bg-green-50 p-4 text-sm text-green-700">{{ session('success') }}</div>
    @endif

    <div class="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
                <thead class="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                    <tr>
                        <th class="px-6 py-3">Маршрут</th>
                        <th class="px-6 py-3">Дни</th>
                        <th class="px-6 py-3">Выезд</th>
                        <th class="px-6 py-3">Мест</th>
                        <th class="px-6 py-3">Цена/место</th>
                        <th class="px-6 py-3">Статус</th>
                        <th class="px-6 py-3">Действия</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    @forelse ($schedules as $schedule)
                        <tr class="hover:bg-gray-50">
                            <td class="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                                {{ $schedule->route?->fromRegion?->name }} → {{ $schedule->route?->toRegion?->name }}
                            </td>
                            <td class="px-6 py-4">
                                <div class="flex gap-1">
                                    @foreach ($dayLabels as $i => $label)
                                        @if ($schedule->days_of_week & (1 << $i))
                                            <span class="inline-flex h-7 w-7 items-center justify-center rounded bg-amber-100 text-xs font-semibold text-amber-700">{{ $label }}</span>
                                        @else
                                            <span class="inline-flex h-7 w-7 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-400">{{ $label }}</span>
                                        @endif
                                    @endforeach
                                </div>
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 font-mono text-gray-700">{{ substr($schedule->departure_time, 0, 5) }}</td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-700">{{ $schedule->max_seats }}</td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-700">{{ number_format($schedule->price_per_seat) }} сом</td>
                            <td class="whitespace-nowrap px-6 py-4">
                                @if ($schedule->is_active)
                                    <span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Активно</span>
                                @else
                                    <span class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">Выключено</span>
                                @endif
                            </td>
                            <td class="whitespace-nowrap px-6 py-4">
                                <div class="flex items-center gap-3">
                                    <a href="{{ route('admin.intercity-schedules.edit', $schedule) }}" class="text-sm font-medium text-amber-600 hover:text-amber-700">Изменить</a>
                                    <form method="POST" action="{{ route('admin.intercity-schedules.destroy', $schedule) }}" onsubmit="return confirm('Удалить расписание? Уже созданные slot\'ы останутся.')">
                                        @csrf
                                        @method('DELETE')
                                        <button type="submit" class="text-sm font-medium text-red-600 hover:text-red-700">Удалить</button>
                                    </form>
                                </div>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="7" class="px-6 py-8 text-center text-gray-500">Расписаний пока нет. Добавьте первое, чтобы cron начал создавать slot'ы.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>

    <div class="mt-4">
        {{ $schedules->links() }}
    </div>
@endsection
