<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\IntercityTrip;
use App\Services\IntercityService;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;
use RuntimeException;

class IntercityTripController extends Controller
{
    public function index(): View
    {
        // Активные сверху (open/claimed/ready/en_route), потом
        // завершённые/отменённые за последние сутки.
        $trips = IntercityTrip::query()
            ->with(['route.fromRegion', 'route.toRegion', 'driver', 'bookings.client'])
            ->orderByRaw("
                CASE
                    WHEN status IN ('open','claimed','ready','en_route') THEN 0
                    ELSE 1
                END
            ")
            ->orderBy('departure_at')
            ->paginate(30);

        return view('admin.intercity-trips.index', compact('trips'));
    }

    public function show(IntercityTrip $intercityTrip): View
    {
        $intercityTrip->load(['route.fromRegion', 'route.toRegion', 'driver.driverProfile', 'bookings.client', 'schedule']);

        return view('admin.intercity-trips.show', ['trip' => $intercityTrip]);
    }

    public function close(IntercityTrip $intercityTrip, IntercityService $service): RedirectResponse
    {
        try {
            $service->closeSlotByAdmin($intercityTrip);

            return redirect()->route('admin.intercity-trips.show', $intercityTrip)
                ->with('success', 'Слот закрыт. Новые брони больше не принимаются.');
        } catch (RuntimeException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function cancel(IntercityTrip $intercityTrip, IntercityService $service): RedirectResponse
    {
        try {
            $service->cancelTripByAdmin($intercityTrip);

            return redirect()->route('admin.intercity-trips.index')
                ->with('success', 'Рейс отменён. Пассажиры получат push.');
        } catch (RuntimeException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }
}
