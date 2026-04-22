@extends('layouts.admin')

@section('title', 'Settings')
@section('heading', 'Settings')

@section('content')
    @if (session('success'))
        <div class="mb-6 rounded-lg bg-green-50 p-4 text-sm text-green-700">
            {{ session('success') }}
        </div>
    @endif

    <div class="mx-auto max-w-2xl">
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <form method="POST" action="{{ route('admin.settings.update') }}">
                @csrf
                @method('PUT')

                {{-- Day Price --}}
                <div class="mb-5">
                    <label for="day_price" class="mb-1.5 block text-sm font-medium text-gray-700">Day Price (KGS)</label>
                    <input
                        type="number"
                        id="day_price"
                        name="day_price"
                        step="1"
                        value="{{ old('day_price', $settings['day_price']->value ?? '') }}"
                        class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
                    >
                    @if (isset($settings['day_price']->description))
                        <p class="mt-1 text-xs text-gray-500">{{ $settings['day_price']->description }}</p>
                    @endif
                    @error('day_price')
                        <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                {{-- Night Price --}}
                <div class="mb-5">
                    <label for="night_price" class="mb-1.5 block text-sm font-medium text-gray-700">Night Price (KGS)</label>
                    <input
                        type="number"
                        id="night_price"
                        name="night_price"
                        step="1"
                        value="{{ old('night_price', $settings['night_price']->value ?? '') }}"
                        class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
                    >
                    @if (isset($settings['night_price']->description))
                        <p class="mt-1 text-xs text-gray-500">{{ $settings['night_price']->description }}</p>
                    @endif
                    @error('night_price')
                        <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                {{-- Cancellation Fee --}}
                <div class="mb-5">
                    <label for="cancellation_fee" class="mb-1.5 block text-sm font-medium text-gray-700">Cancellation Fee (KGS)</label>
                    <input
                        type="number"
                        id="cancellation_fee"
                        name="cancellation_fee"
                        step="1"
                        value="{{ old('cancellation_fee', $settings['cancellation_fee']->value ?? '') }}"
                        class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
                    >
                    @if (isset($settings['cancellation_fee']->description))
                        <p class="mt-1 text-xs text-gray-500">{{ $settings['cancellation_fee']->description }}</p>
                    @endif
                    @error('cancellation_fee')
                        <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                {{-- Max Search Radius --}}
                <div class="mb-5">
                    <label for="max_search_radius_km" class="mb-1.5 block text-sm font-medium text-gray-700">Max Search Radius (km)</label>
                    <input
                        type="number"
                        id="max_search_radius_km"
                        name="max_search_radius_km"
                        step="0.1"
                        value="{{ old('max_search_radius_km', $settings['max_search_radius_km']->value ?? '') }}"
                        class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
                    >
                    @if (isset($settings['max_search_radius_km']->description))
                        <p class="mt-1 text-xs text-gray-500">{{ $settings['max_search_radius_km']->description }}</p>
                    @endif
                    @error('max_search_radius_km')
                        <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                {{-- Stale Active Order Hours --}}
                <div class="mb-5">
                    <label for="stale_active_order_hours" class="mb-1.5 block text-sm font-medium text-gray-700">Stale Active Order Hours</label>
                    <input
                        type="number"
                        id="stale_active_order_hours"
                        name="stale_active_order_hours"
                        step="0.5"
                        value="{{ old('stale_active_order_hours', $settings['stale_active_order_hours']->value ?? '2') }}"
                        class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
                    >
                    @if (isset($settings['stale_active_order_hours']->description))
                        <p class="mt-1 text-xs text-gray-500">{{ $settings['stale_active_order_hours']->description }}</p>
                    @endif
                    @error('stale_active_order_hours')
                        <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                {{-- Actions --}}
                <div class="flex items-center gap-4">
                    <button
                        type="submit"
                        class="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-amber-600"
                    >
                        Save Settings
                    </button>
                </div>
            </form>
        </div>
    </div>
@endsection
