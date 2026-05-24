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

        // Все цены живут в матрице /admin/region-routes. Карточка
        // района — только название и флаги.
        return [
            'name' => ['required', 'string', 'max:255', $nameUnique],
            'is_active' => ['boolean'],
            'sort_order' => ['integer', 'min:0'],
        ];
    }
}
