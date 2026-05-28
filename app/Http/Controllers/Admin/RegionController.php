<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Region;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class RegionController extends Controller
{
    public function index(): View
    {
        $regions = Region::orderBy('sort_order')
            ->orderBy('name')
            ->paginate(15);

        return view('admin.regions.index', compact('regions'));
    }

    public function create(): View
    {
        return view('admin.regions.create');
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate($this->validationRules());

        $validated['is_active'] = $request->boolean('is_active');
        $validated['is_intercity_only'] = $request->boolean('is_intercity_only');

        Region::create($validated);

        return redirect()->route('admin.regions.index')
            ->with('success', 'Region created successfully.');
    }

    public function edit(Region $region): View
    {
        return view('admin.regions.edit', compact('region'));
    }

    public function update(Request $request, Region $region): RedirectResponse
    {
        $validated = $request->validate($this->validationRules($region->id));

        $validated['is_active'] = $request->boolean('is_active');
        $validated['is_intercity_only'] = $request->boolean('is_intercity_only');

        $region->update($validated);

        return redirect()->route('admin.regions.index')
            ->with('success', 'Region updated successfully.');
    }

    public function destroy(Region $region): RedirectResponse
    {
        $region->delete();

        return redirect()->route('admin.regions.index')
            ->with('success', 'Region deleted successfully.');
    }

    /**
     * @return array<string, array<int, string>|string>
     */
    private function validationRules(?int $ignoreId = null): array
    {
        $nameUnique = 'unique:regions,name'.($ignoreId ? ','.$ignoreId : '');

        // Все цены живут в матрице /admin/region-routes. В карточке —
        // только идентификация и (опционально) координаты центра.
        // С координатами район становится «сервисным» (GPS-определение,
        // там могут жить наши клиенты). Без координат — «только
        // направление» для межсёлами.
        return [
            'name' => ['required', 'string', 'max:255', $nameUnique],
            'is_active' => ['boolean'],
            'is_intercity_only' => ['boolean'],
            'sort_order' => ['integer', 'min:0'],
            'center_latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'center_longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ];
    }
}
