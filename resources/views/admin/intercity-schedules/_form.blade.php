@props(['schedule' => null, 'routes'])

@php
    $dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    $selectedMask = (int) old('days_of_week_mask', $schedule?->days_of_week ?? 0);
@endphp

<div class="mb-5">
    <label for="route_id" class="mb-1.5 block text-sm font-medium text-gray-700">Маршрут</label>
    <select id="route_id" name="route_id" class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400">
        <option value="">— выберите —</option>
        @foreach ($routes as $route)
            <option value="{{ $route->id }}" @selected(old('route_id', $schedule?->route_id) == $route->id)>
                {{ $route->fromRegion?->name }} → {{ $route->toRegion?->name }}
            </option>
        @endforeach
    </select>
    @error('route_id') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
</div>

<div class="mb-5">
    <label class="mb-1.5 block text-sm font-medium text-gray-700">Дни недели</label>
    <div class="flex flex-wrap gap-2">
        @foreach ($dayLabels as $i => $label)
            <label class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-amber-50">
                <input
                    type="checkbox"
                    name="days_of_week[]"
                    value="{{ $i }}"
                    {{ in_array($i, old('days_of_week', [])) || ($selectedMask & (1 << $i)) ? 'checked' : '' }}
                    class="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                >
                <span>{{ $label }}</span>
            </label>
        @endforeach
    </div>
    @error('days_of_week') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
</div>

<div class="mb-5 grid grid-cols-3 gap-4">
    <div>
        <label for="departure_time" class="mb-1.5 block text-sm font-medium text-gray-700">Время выезда</label>
        <input
            type="time"
            id="departure_time"
            name="departure_time"
            value="{{ old('departure_time', $schedule ? substr($schedule->departure_time, 0, 5) : '07:00') }}"
            class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
        >
        @error('departure_time') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
    </div>
    <div>
        <label for="max_seats" class="mb-1.5 block text-sm font-medium text-gray-700">Мест в машине</label>
        <input
            type="number"
            id="max_seats"
            name="max_seats"
            value="{{ old('max_seats', $schedule?->max_seats ?? 7) }}"
            min="2"
            max="15"
            class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
        >
        @error('max_seats') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
    </div>
    <div>
        <label for="price_per_seat" class="mb-1.5 block text-sm font-medium text-gray-700">Цена за место (сом)</label>
        <input
            type="number"
            id="price_per_seat"
            name="price_per_seat"
            value="{{ old('price_per_seat', $schedule?->price_per_seat ?? 600) }}"
            min="0"
            class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
        >
        @error('price_per_seat') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
    </div>
</div>

<div class="mb-6">
    <label class="flex items-center gap-2">
        <input
            type="checkbox"
            name="is_active"
            value="1"
            {{ old('is_active', $schedule?->is_active ?? true) ? 'checked' : '' }}
            class="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
        >
        <span class="text-sm text-gray-700">Расписание активно (cron создаёт slot'ы каждое утро)</span>
    </label>
</div>
