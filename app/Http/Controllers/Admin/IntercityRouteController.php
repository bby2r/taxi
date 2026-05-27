<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\IntercityRoute;
use App\Models\Region;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class IntercityRouteController extends Controller
{
    public function index(): View
    {
        $routes = IntercityRoute::with(['fromRegion', 'toRegion'])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->paginate(20);

        return view('admin.intercity-routes.index', compact('routes'));
    }

    public function create(): View
    {
        $regions = Region::active()->orderBy('sort_order')->orderBy('name')->get();

        return view('admin.intercity-routes.create', compact('regions'));
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate($this->validationRules());
        $validated['is_active'] = $request->boolean('is_active');

        IntercityRoute::create($validated);

        return redirect()->route('admin.intercity-routes.index')
            ->with('success', 'Маршрут добавлен.');
    }

    public function edit(IntercityRoute $intercityRoute): View
    {
        $regions = Region::active()->orderBy('sort_order')->orderBy('name')->get();

        return view('admin.intercity-routes.edit', [
            'route' => $intercityRoute,
            'regions' => $regions,
        ]);
    }

    public function update(Request $request, IntercityRoute $intercityRoute): RedirectResponse
    {
        $validated = $request->validate($this->validationRules($intercityRoute->id));
        $validated['is_active'] = $request->boolean('is_active');

        $intercityRoute->update($validated);

        return redirect()->route('admin.intercity-routes.index')
            ->with('success', 'Маршрут обновлён.');
    }

    public function destroy(IntercityRoute $intercityRoute): RedirectResponse
    {
        $intercityRoute->delete();

        return redirect()->route('admin.intercity-routes.index')
            ->with('success', 'Маршрут удалён.');
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    private function validationRules(?int $ignoreId = null): array
    {
        return [
            'from_region_id' => ['required', 'integer', 'exists:regions,id', 'different:to_region_id'],
            'to_region_id' => ['required', 'integer', 'exists:regions,id'],
            'max_seats' => ['required', 'integer', 'between:2,15'],
            'price_per_seat' => ['required', 'integer', 'min:0'],
            'is_active' => ['boolean'],
            'sort_order' => ['integer', 'min:0'],
        ];
    }
}
