@extends('layouts.admin')

@section('title', 'Межгород маршруты')
@section('heading', 'Межгород маршруты')

@section('content')
    <div class="mb-6 flex items-center justify-between">
        <p class="text-sm text-gray-600">Всего: {{ $routes->total() }} маршрутов</p>
        <a
            href="{{ route('admin.intercity-routes.create') }}"
            class="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-amber-600"
        >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
                <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            Добавить маршрут
        </a>
    </div>

    @if (session('success'))
        <div class="mb-4 rounded-lg bg-green-50 p-4 text-sm text-green-700">{{ session('success') }}</div>
    @endif

    <div class="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
                <thead class="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                    <tr>
                        <th class="px-6 py-3">Откуда → Куда</th>
                        <th class="px-6 py-3">Мест</th>
                        <th class="px-6 py-3">Цена/место</th>
                        <th class="px-6 py-3">Всего за рейс</th>
                        <th class="px-6 py-3">Статус</th>
                        <th class="px-6 py-3">Действия</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    @forelse ($routes as $route)
                        <tr class="hover:bg-gray-50">
                            <td class="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                                {{ $route->fromRegion?->name }} → {{ $route->toRegion?->name }}
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-700">{{ $route->max_seats }}</td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-700">{{ number_format($route->price_per_seat) }} сом</td>
                            <td class="whitespace-nowrap px-6 py-4 font-semibold text-amber-600">{{ number_format($route->price_per_seat * $route->max_seats) }} сом</td>
                            <td class="whitespace-nowrap px-6 py-4">
                                @if ($route->is_active)
                                    <span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Активен</span>
                                @else
                                    <span class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">Выключен</span>
                                @endif
                            </td>
                            <td class="whitespace-nowrap px-6 py-4">
                                <div class="flex items-center gap-3">
                                    <a href="{{ route('admin.intercity-routes.edit', $route) }}" class="text-sm font-medium text-amber-600 hover:text-amber-700">Изменить</a>
                                    <form method="POST" action="{{ route('admin.intercity-routes.destroy', $route) }}" onsubmit="return confirm('Удалить маршрут?')">
                                        @csrf
                                        @method('DELETE')
                                        <button type="submit" class="text-sm font-medium text-red-600 hover:text-red-700">Удалить</button>
                                    </form>
                                </div>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="6" class="px-6 py-8 text-center text-gray-500">Маршрутов пока нет.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>

    <div class="mt-4">
        {{ $routes->links() }}
    </div>
@endsection
