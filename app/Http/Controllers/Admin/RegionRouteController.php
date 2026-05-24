<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Region;
use App\Models\RegionRoute;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class RegionRouteController extends Controller
{
    /**
     * Matrix view: rows = from-region, cols = to-region, cells contain
     * day/night price inputs. Existing routes pre-fill the inputs;
     * leaving a cell blank means "use destination's flat tariff".
     */
    public function index(): View
    {
        $regions = Region::active()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        // Index existing routes as $routes[fromId][toId] = RegionRoute
        // for O(1) lookup while rendering the matrix.
        $routes = RegionRoute::all()
            ->groupBy('from_region_id')
            ->map(fn ($group) => $group->keyBy('to_region_id'));

        return view('admin.region-routes.index', compact('regions', 'routes'));
    }

    /**
     * Bulk upsert: form posts back a routes[from][to] => [day, night]
     * matrix. Empty cells delete any existing route for that pair so
     * the operator can clear an override by blanking both fields.
     */
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'routes' => ['array'],
            'routes.*' => ['array'],
            'routes.*.*.day' => ['nullable', 'integer', 'min:0'],
            'routes.*.*.night' => ['nullable', 'integer', 'min:0'],
        ]);

        $regionIds = Region::active()->pluck('id')->all();
        $regionIdSet = array_flip($regionIds);

        DB::transaction(function () use ($validated, $regionIdSet) {
            foreach ($validated['routes'] ?? [] as $fromId => $toMap) {
                if (! isset($regionIdSet[$fromId])) {
                    continue;
                }
                foreach ($toMap as $toId => $prices) {
                    if (! isset($regionIdSet[$toId]) || (int) $fromId === (int) $toId) {
                        continue;
                    }
                    $day = $prices['day'] ?? null;
                    $night = $prices['night'] ?? null;

                    if ($day === null && $night === null) {
                        RegionRoute::where('from_region_id', $fromId)
                            ->where('to_region_id', $toId)
                            ->delete();

                        continue;
                    }

                    // Partial fills aren't useful — the order service
                    // needs both day and night when the route exists.
                    // Asking the operator to supply both is friendlier
                    // than silently defaulting one to the destination
                    // tariff and creating two different fallback paths.
                    if ($day === null || $night === null) {
                        continue;
                    }

                    RegionRoute::updateOrCreate(
                        ['from_region_id' => $fromId, 'to_region_id' => $toId],
                        ['day_price' => (int) $day, 'night_price' => (int) $night],
                    );
                }
            }
        });

        return redirect()->route('admin.region-routes.index')
            ->with('success', 'Матрица тарифов обновлена.');
    }
}
