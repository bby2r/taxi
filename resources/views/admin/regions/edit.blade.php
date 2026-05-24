@extends('layouts.admin')

@section('title', 'Редактировать регион')
@section('heading', 'Редактировать регион')

@section('content')
    <div class="mx-auto max-w-2xl">
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <form method="POST" action="{{ route('admin.regions.update', $region) }}">
                @csrf
                @method('PUT')

                {{-- Name --}}
                <div class="mb-5">
                    <label for="name" class="mb-1.5 block text-sm font-medium text-gray-700">Название</label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value="{{ old('name', $region->name) }}"
                        class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
                    >
                    @error('name')
                        <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                {{-- Межсельные цены (день/ночь) задаются отдельно через матрицу
                     /admin/region-routes. Здесь только название, гео-центр и
                     цена внутри района. --}}

                {{-- District in-village tariff section. Optional — when blank,
                     the global "В селе" tariff from Settings is used. --}}
                <div class="mb-2 mt-2 border-t border-gray-200 pt-4">
                    <h3 class="mb-1 text-sm font-semibold text-gray-800">Тариф внутри района (Гео-A+)</h3>
                    <p class="mb-4 text-xs text-gray-500">Заказы клиента, физически находящегося в этом районе. Если пусто — берётся общий тариф «в селе» из Настроек.</p>
                </div>

                <div class="mb-5 grid grid-cols-2 gap-4">
                    <div>
                        <label for="in_district_day_price" class="mb-1.5 block text-sm font-medium text-gray-700">День (07-20)</label>
                        <input
                            type="number"
                            id="in_district_day_price"
                            name="in_district_day_price"
                            value="{{ old('in_district_day_price', $region->in_district_day_price) }}"
                            step="1"
                            min="0"
                            placeholder="80"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
                        >
                        @error('in_district_day_price')
                            <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                        @enderror
                    </div>
                    <div>
                        <label for="in_district_night_price" class="mb-1.5 block text-sm font-medium text-gray-700">Ночь (21-06)</label>
                        <input
                            type="number"
                            id="in_district_night_price"
                            name="in_district_night_price"
                            value="{{ old('in_district_night_price', $region->in_district_night_price) }}"
                            step="1"
                            min="0"
                            placeholder="120"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
                        >
                        @error('in_district_night_price')
                            <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                        @enderror
                    </div>
                </div>

                {{-- District centre coordinates. Used to map a client's GPS
                     to "which district am I in?" via nearest-centre haversine. --}}
                <div class="mb-2 mt-2 border-t border-gray-200 pt-4">
                    <h3 class="mb-1 text-sm font-semibold text-gray-800">Центр района (для определения по GPS)</h3>
                    <p class="mb-4 text-xs text-gray-500">Координаты центра села/города. Клиент попадает в этот район, если его GPS ближе к этому центру, чем к другим.</p>
                </div>

                <div class="mb-5 grid grid-cols-2 gap-4">
                    <div>
                        <label for="center_latitude" class="mb-1.5 block text-sm font-medium text-gray-700">Широта</label>
                        <input
                            type="number"
                            id="center_latitude"
                            name="center_latitude"
                            value="{{ old('center_latitude', $region->center_latitude) }}"
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
                            value="{{ old('center_longitude', $region->center_longitude) }}"
                            step="0.0000001"
                            placeholder="72.2425"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
                        >
                        @error('center_longitude')
                            <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                        @enderror
                    </div>
                </div>

                {{-- Sort Order --}}
                <div class="mb-5">
                    <label for="sort_order" class="mb-1.5 block text-sm font-medium text-gray-700">Порядок сортировки</label>
                    <input
                        type="number"
                        id="sort_order"
                        name="sort_order"
                        value="{{ old('sort_order', $region->sort_order) }}"
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
                        <input type="checkbox" name="is_active" value="1" {{ old('is_active', $region->is_active) ? 'checked' : '' }} class="rounded border-gray-300 text-amber-500 focus:ring-amber-400">
                        <span class="text-sm text-gray-700">Регион активен</span>
                    </label>
                    @error('is_active')
                        <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                {{-- Подсказка про матрицу --}}
                <div class="mb-5 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                    <p class="font-medium">Межсельные тарифы</p>
                    <p class="mt-1 leading-relaxed">
                        Цены поездок из этого района в другие задаются на странице
                        <a href="{{ route('admin.region-routes.index') }}" class="font-semibold underline">Тарифы межсёлами</a>.
                    </p>
                </div>

                {{-- Actions --}}
                <div class="flex items-center gap-4">
                    <button
                        type="submit"
                        class="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-amber-600"
                    >
                        Обновить регион
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
