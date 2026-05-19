@extends('layouts.admin')

@section('title', 'Водители')
@section('heading', 'Водители')

@section('content')
    {{-- Header --}}
    <div class="mb-6 flex items-center justify-between">
        <p class="text-sm text-gray-600">Всего: {{ $drivers->total() }} водителей</p>
        <a
            href="{{ route('admin.drivers.create') }}"
            class="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-amber-600"
        >
            {{-- Heroicon: plus (mini) --}}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
                <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            Добавить водителя
        </a>
    </div>

    {{-- Flash Messages --}}
    @if (session('success'))
        <div class="mb-4 rounded-lg bg-green-50 p-4 text-sm text-green-700">
            {{ session('success') }}
        </div>
    @endif

    @if (session('error'))
        <div class="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {{ session('error') }}
        </div>
    @endif

    {{-- Table --}}
    <div class="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
                <thead class="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                    <tr>
                        <th class="px-6 py-3">Имя</th>
                        <th class="px-6 py-3">Телефон</th>
                        <th class="px-6 py-3">Авто</th>
                        <th class="px-6 py-3">Номер авто</th>
                        <th class="px-6 py-3">Статус</th>
                        <th class="px-6 py-3">Дата регистрации</th>
                        <th class="px-6 py-3">Действия</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    @forelse ($drivers as $driver)
                        <tr class="hover:bg-gray-50">
                            <td class="whitespace-nowrap px-6 py-4 font-medium text-gray-900">{{ $driver->name }}</td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-700">{{ $driver->phone }}</td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-700">{{ $driver->driverProfile?->car_model ?? '—' }}</td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-700">{{ $driver->driverProfile?->car_number ?? '—' }}</td>
                            <td class="whitespace-nowrap px-6 py-4">
                                @php
                                    $profile = $driver->driverProfile;
                                    $lastSeen = $profile?->location_updated_at;
                                    // Live = is_online + recent ping. Stale = is_online flag is on but no
                                    // ping in the last 30 s (OEM killed the process / phone died) — these
                                    // drivers are excluded from dispatch by GeoService until the ping returns.
                                    $isLive = $profile?->is_online
                                        && $lastSeen
                                        && $lastSeen->greaterThan(now()->subSeconds(30));
                                    $isStaleOnline = $profile?->is_online && ! $isLive;
                                @endphp
                                @if ($isLive)
                                    <span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Онлайн</span>
                                @elseif ($isStaleOnline)
                                    <span
                                        class="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700"
                                        title="Последний пинг: {{ $lastSeen?->diffForHumans() ?? '—' }}"
                                    >
                                        Заглохший ({{ $lastSeen?->diffForHumans(syntax: \Carbon\CarbonInterface::DIFF_ABSOLUTE) ?? '?' }})
                                    </span>
                                @else
                                    <span class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">Не на линии</span>
                                @endif
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-500">{{ $driver->created_at->format('d.m.Y') }}</td>
                            <td class="whitespace-nowrap px-6 py-4">
                                <div class="flex items-center gap-3">
                                    <a
                                        href="{{ route('admin.drivers.edit', $driver) }}"
                                        class="text-sm font-medium text-amber-600 hover:text-amber-700"
                                    >
                                        Редактировать
                                    </a>
                                    <form
                                        method="POST"
                                        action="{{ route('admin.drivers.destroy', $driver) }}"
                                        onsubmit="return confirm('Вы уверены, что хотите удалить этого водителя?')"
                                    >
                                        @csrf
                                        @method('DELETE')
                                        <button type="submit" class="text-sm font-medium text-red-600 hover:text-red-700">
                                            Удалить
                                        </button>
                                    </form>
                                </div>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="7" class="px-6 py-8 text-center text-gray-500">Водителей нет.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>

    {{-- Pagination --}}
    <div class="mt-4">
        {{ $drivers->links() }}
    </div>
@endsection
