@extends('layouts.admin')

@section('title', 'Добавить район')
@section('heading', 'Добавить район')

@section('content')
    <div class="mx-auto max-w-2xl">
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <form method="POST" action="{{ route('admin.regions.store') }}">
                @csrf

                {{-- Name --}}
                <div class="mb-5">
                    <label for="name" class="mb-1.5 block text-sm font-medium text-gray-700">Название</label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value="{{ old('name') }}"
                        class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
                    >
                    @error('name')
                        <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                {{-- Sort Order --}}
                <div class="mb-5">
                    <label for="sort_order" class="mb-1.5 block text-sm font-medium text-gray-700">Порядок сортировки</label>
                    <input
                        type="number"
                        id="sort_order"
                        name="sort_order"
                        value="{{ old('sort_order', 0) }}"
                        step="1"
                        min="0"
                        class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
                    >
                    @error('sort_order')
                        <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                {{-- Active --}}
                <div class="mb-5">
                    <label class="flex items-center gap-2">
                        <input type="checkbox" name="is_active" value="1" {{ old('is_active', true) ? 'checked' : '' }} class="rounded border-gray-300 text-amber-500 focus:ring-amber-400">
                        <span class="text-sm text-gray-700">Район активен</span>
                    </label>
                    @error('is_active')
                        <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                {{-- Координаты центра (определяют сервисную зону) --}}
                <div class="mb-2 mt-2 border-t border-gray-200 pt-4">
                    <h3 class="mb-1 text-sm font-semibold text-gray-800">Центр района (опционально)</h3>
                    <p class="mb-4 text-xs text-gray-500">
                        Заполните для районов где есть наши клиенты — тогда GPS-определение будет работать
                        и клиенты в радиусе ~5 км смогут заказывать. <strong>Без координат</strong> — район
                        будет показываться только как направление в межсёлами.
                    </p>
                </div>

                <div class="mb-5 grid grid-cols-2 gap-4">
                    <div>
                        <label for="center_latitude" class="mb-1.5 block text-sm font-medium text-gray-700">Широта</label>
                        <input
                            type="number"
                            id="center_latitude"
                            name="center_latitude"
                            value="{{ old('center_latitude') }}"
                            step="0.0000001"
                            placeholder="42.5228"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
                        >
                        @error('center_latitude')
                            <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                        @enderror
                    </div>
                    <div>
                        <label for="center_longitude" class="mb-1.5 block text-sm font-medium text-gray-700">Долгота</label>
                        <input
                            type="number"
                            id="center_longitude"
                            name="center_longitude"
                            value="{{ old('center_longitude') }}"
                            step="0.0000001"
                            placeholder="72.2425"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
                        >
                        @error('center_longitude')
                            <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                        @enderror
                    </div>
                </div>

                {{-- Подсказка про матрицу --}}
                <div class="mb-5 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                    <p class="font-medium">Цены поездок</p>
                    <p class="mt-1 leading-relaxed">
                        После создания района зайдите в
                        <a href="{{ route('admin.region-routes.index') }}" class="font-semibold underline">Тарифы поездок</a>
                        и заполните цены: внутри района (диагональ матрицы) и в другие сёла.
                    </p>
                </div>

                {{-- Actions --}}
                <div class="flex items-center gap-4">
                    <button
                        type="submit"
                        class="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-amber-600"
                    >
                        Создать район
                    </button>
                    <a
                        href="{{ route('admin.regions.index') }}"
                        class="text-sm font-medium text-gray-600 hover:text-gray-800"
                    >
                        Отмена
                    </a>
                </div>
            </form>
        </div>
    </div>
@endsection
