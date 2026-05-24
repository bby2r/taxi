@extends('layouts.admin')

@section('title', 'Тарифы межрайон')
@section('heading', 'Тарифы межсёлами')

@section('content')
    <div class="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        <p class="font-medium">Это единственное место где задаются межсельные цены</p>
        <ul class="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
            <li>Строки — <strong>откуда</strong> едет клиент. Колонки — <strong>куда</strong> едет.</li>
            <li>Заполняйте обе цены: <strong>день</strong> (07–20) и <strong>ночь</strong> (21–06).</li>
            <li>Незаполненные ячейки → клиенту покажется цена <strong>0 сом</strong> и заказ работать не будет.</li>
            <li>Чтобы убрать маршрут — очистите оба поля и сохраните.</li>
        </ul>
    </div>

    @if (session('success'))
        <div class="mb-4 rounded-lg bg-green-50 p-4 text-sm text-green-700">
            {{ session('success') }}
        </div>
    @endif

    @if ($regions->count() < 2)
        <div class="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
            Для матрицы нужно минимум 2 активных района.
            <a href="{{ route('admin.regions.create') }}" class="font-medium underline">Добавить район</a>
        </div>
    @else
        <form method="POST" action="{{ route('admin.region-routes.update') }}">
            @csrf
            @method('PUT')

            <div class="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table class="w-full text-left text-sm">
                    <thead class="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                        <tr>
                            <th class="px-4 py-3 text-left">Откуда ↓ / Куда →</th>
                            @foreach ($regions as $to)
                                <th class="px-4 py-3 text-center">{{ $to->name }}</th>
                            @endforeach
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        @foreach ($regions as $from)
                            <tr class="hover:bg-gray-50/50">
                                <td class="px-4 py-3 font-medium text-gray-900">{{ $from->name }}</td>
                                @foreach ($regions as $to)
                                    <td class="px-4 py-3">
                                        @if ($from->id === $to->id)
                                            <span class="block text-center text-xs text-gray-400">в селе</span>
                                        @else
                                            @php
                                                $route = $routes[$from->id][$to->id] ?? null;
                                            @endphp
                                            <div class="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    name="routes[{{ $from->id }}][{{ $to->id }}][day]"
                                                    value="{{ old("routes.{$from->id}.{$to->id}.day", $route?->day_price) }}"
                                                    placeholder="день"
                                                    step="1"
                                                    min="0"
                                                    class="w-20 rounded-md border border-gray-300 px-2 py-1 text-center text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                                                >
                                                <span class="text-gray-300">/</span>
                                                <input
                                                    type="number"
                                                    name="routes[{{ $from->id }}][{{ $to->id }}][night]"
                                                    value="{{ old("routes.{$from->id}.{$to->id}.night", $route?->night_price) }}"
                                                    placeholder="ночь"
                                                    step="1"
                                                    min="0"
                                                    class="w-20 rounded-md border border-gray-300 px-2 py-1 text-center text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                                                >
                                            </div>
                                        @endif
                                    </td>
                                @endforeach
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>

            <div class="mt-6 flex items-center gap-4">
                <button
                    type="submit"
                    class="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-amber-600"
                >
                    Сохранить матрицу
                </button>
                <a
                    href="{{ route('admin.regions.index') }}"
                    class="text-sm font-medium text-gray-600 hover:text-gray-800"
                >
                    К списку районов
                </a>
            </div>
        </form>
    @endif
@endsection
