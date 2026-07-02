<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\IntercityRoute;
use App\Models\IntercityRouteSchedule;
use App\Services\IntercityService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class IntercityScheduleController extends Controller
{
    public function index(): View
    {
        $schedules = IntercityRouteSchedule::with(['route.fromRegion', 'route.toRegion'])
            ->orderBy('route_id')
            ->orderBy('departure_time')
            ->paginate(30);

        return view('admin.intercity-schedules.index', compact('schedules'));
    }

    public function create(): View
    {
        $routes = IntercityRoute::with(['fromRegion', 'toRegion'])
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return view('admin.intercity-schedules.create', compact('routes'));
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validateRequest($request);
        IntercityRouteSchedule::create($validated);

        return redirect()->route('admin.intercity-schedules.index')
            ->with('success', 'Расписание добавлено.');
    }

    public function edit(IntercityRouteSchedule $intercitySchedule): View
    {
        $routes = IntercityRoute::with(['fromRegion', 'toRegion'])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return view('admin.intercity-schedules.edit', [
            'schedule' => $intercitySchedule,
            'routes' => $routes,
        ]);
    }

    public function update(Request $request, IntercityRouteSchedule $intercitySchedule): RedirectResponse
    {
        $validated = $this->validateRequest($request);
        $intercitySchedule->update($validated);

        return redirect()->route('admin.intercity-schedules.index')
            ->with('success', 'Расписание обновлено.');
    }

    public function destroy(IntercityRouteSchedule $intercitySchedule): RedirectResponse
    {
        $intercitySchedule->delete();

        return redirect()->route('admin.intercity-schedules.index')
            ->with('success', 'Расписание удалено.');
    }

    public function generateNow(IntercityService $service): RedirectResponse
    {
        $today = Carbon::now('Asia/Bishkek')->startOfDay();
        $total = 0;
        for ($i = 0; $i < 2; $i++) {
            $total += $service->generateSlotsForDate($today->copy()->addDays($i));
        }

        return redirect()->route('admin.intercity-schedules.index')
            ->with('success', "Создано {$total} slot'ов на сегодня + завтра.");
    }

    /**
     * @return array<string, mixed>
     */
    private function validateRequest(Request $request): array
    {
        $request->validate([
            'route_id' => ['required', 'integer', 'exists:intercity_routes,id'],
            'days_of_week' => ['required', 'array', 'min:1'],
            'days_of_week.*' => ['integer', 'between:0,6'],
            'departure_time' => ['required', 'date_format:H:i'],
            'max_seats' => ['required', 'integer', 'between:2,4'],
            'price_per_seat' => ['required', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        // Pack the day-of-week checkboxes (bit 0 = Mon ... bit 6 = Sun)
        // into a single bitmask so we can ask "does this run today?" with
        // one bitwise AND in the cron at 05:00.
        $mask = 0;
        foreach ((array) $request->input('days_of_week', []) as $bit) {
            $mask |= (1 << (int) $bit);
        }

        return [
            'route_id' => (int) $request->input('route_id'),
            'days_of_week' => $mask,
            'departure_time' => $request->input('departure_time').':00',
            'max_seats' => (int) $request->input('max_seats'),
            'price_per_seat' => (int) $request->input('price_per_seat'),
            'is_active' => $request->boolean('is_active'),
        ];
    }
}
