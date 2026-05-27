@props(['route' => null, 'regions'])

<div class="mb-5 grid grid-cols-2 gap-4">
    <div>
        <label for="from_region_id" class="mb-1.5 block text-sm font-medium text-gray-700">Откуда</label>
        <select id="from_region_id" name="from_region_id" class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400">
            <option value="">— выберите —</option>
            @foreach ($regions as $region)
                <option value="{{ $region->id }}" @selected(old('from_region_id', $route?->from_region_id) == $region->id)>{{ $region->name }}</option>
            @endforeach
        </select>
        @error('from_region_id') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
    </div>
    <div>
        <label for="to_region_id" class="mb-1.5 block text-sm font-medium text-gray-700">Куда</label>
        <select id="to_region_id" name="to_region_id" class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400">
            <option value="">— выберите —</option>
            @foreach ($regions as $region)
                <option value="{{ $region->id }}" @selected(old('to_region_id', $route?->to_region_id) == $region->id)>{{ $region->name }}</option>
            @endforeach
        </select>
        @error('to_region_id') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
    </div>
</div>

<div class="mb-5 grid grid-cols-2 gap-4">
    <div>
        <label for="max_seats" class="mb-1.5 block text-sm font-medium text-gray-700">Мест в машине</label>
        <input type="number" id="max_seats" name="max_seats" value="{{ old('max_seats', $route?->max_seats ?? 4) }}" min="2" max="15" class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400">
        <p class="mt-1 text-xs text-gray-500">2–4 для седана, 6–8 для минивэна, до 15 для микроавтобуса</p>
        @error('max_seats') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
    </div>
    <div>
        <label for="price_per_seat" class="mb-1.5 block text-sm font-medium text-gray-700">Цена за место (сом)</label>
        <input type="number" id="price_per_seat" name="price_per_seat" value="{{ old('price_per_seat', $route?->price_per_seat ?? 500) }}" min="0" class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400">
        @error('price_per_seat') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
    </div>
</div>

<div class="mb-5">
    <label for="sort_order" class="mb-1.5 block text-sm font-medium text-gray-700">Порядок сортировки</label>
    <input type="number" id="sort_order" name="sort_order" value="{{ old('sort_order', $route?->sort_order ?? 0) }}" min="0" class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400">
</div>

<div class="mb-6">
    <label class="flex items-center gap-2">
        <input type="checkbox" name="is_active" value="1" {{ old('is_active', $route?->is_active ?? true) ? 'checked' : '' }} class="rounded border-gray-300 text-amber-500 focus:ring-amber-400">
        <span class="text-sm text-gray-700">Маршрут активен (клиенты видят и могут бронировать)</span>
    </label>
</div>
