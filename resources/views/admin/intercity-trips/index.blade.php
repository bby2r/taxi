@extends('layouts.admin')

@section('title', 'Межгород-рейсы')
@section('heading', 'Межгород-рейсы')

@php
    $statusLabels = [
        'open' => ['Открыт', 'bg-gray-100 text-gray-700'],
        'claimed' => ['Принят', 'bg-amber-100 text-amber-700'],
        'ready' => ['Готов', 'bg-blue-100 text-blue-700'],
        'en_route' => ['В пути', 'bg-emerald-100 text-emerald-700'],
        'completed' => ['Завершён', 'bg-emerald-50 text-emerald-600'],
        'cancelled' => ['Отменён', 'bg-red-50 text-red-600'],
    ];
@endphp

@section('content')
    @include('admin.partials.flash')

    <p class="mb-4 text-sm text-gray-600">Всего: {{ $trips->total() }} рейсов</p>

    <div class="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
                <thead class="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                    <tr>
                        <th class="px-6 py-3">Маршрут</th>
                        <th class="px-6 py-3">Выезд</th>
                        <th class="px-6 py-3">Статус</th>
                        <th class="px-6 py-3">Водитель</th>
                        <th class="px-6 py-3">Места</th>
                        <th class="px-6 py-3">Действия</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    @forelse ($trips as $trip)
                        @php
                            [$label, $pillCss] = $statusLabels[$trip->status->value] ?? [$trip->status->value, 'bg-gray-100 text-gray-700'];
                            $seatsBooked = $trip->seatsBooked();
                        @endphp
                        <tr class="hover:bg-gray-50">
                            <td class="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                                {{ $trip->route?->fromRegion?->name }} → {{ $trip->route?->toRegion?->name }}
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-700">
                                {{ $trip->departure_at?->timezone('Asia/Bishkek')->format('d M, H:i') }}
                            </td>
                            <td class="whitespace-nowrap px-6 py-4">
                                <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {{ $pillCss }}">
                                    {{ $label }}
                                </span>
                                @if ($trip->is_closed)
                                    <span class="ml-1 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">закрыт</span>
                                @endif
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-700">
                                @if ($trip->driver)
                                    <span class="font-medium">{{ $trip->driver_name ?? $trip->driver->name }}</span>
                                    <span class="block text-xs text-gray-500">{{ $trip->car_model }} {{ $trip->car_number }}</span>
                                @else
                                    <span class="text-gray-400">—</span>
                                @endif
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-700">
                                {{ $seatsBooked }} / {{ $trip->max_seats }}
                            </td>
                            <td class="whitespace-nowrap px-6 py-4">
                                <a href="{{ route('admin.intercity-trips.show', $trip) }}" class="text-sm font-medium text-amber-600 hover:text-amber-700">Подробнее</a>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="6" class="px-6 py-8 text-center text-gray-500">Рейсов пока нет.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>

    <div class="mt-4">
        {{ $trips->links() }}
    </div>
@endsection
