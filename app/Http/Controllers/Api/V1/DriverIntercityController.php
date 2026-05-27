<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\IntercityBookingStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\V1\IntercityTripResource;
use App\Models\IntercityBooking;
use App\Models\IntercityRoute;
use App\Models\IntercityTrip;
use App\Services\IntercityService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class DriverIntercityController extends Controller
{
    public function __construct(private readonly IntercityService $service) {}

    /**
     * Готовые к принятию batch'и: маршруты+даты где набралось
     * max_seats pending bookings. Группируем bookings по route+date,
     * фильтруем где сумма seats >= route.max_seats.
     */
    public function available(): JsonResponse
    {
        // Берём все pending bookings, группируем по route_id +
        // departure_date, считаем сумму мест. Те где сумма >= max_seats
        // и водитель ещё не схватил — это available offers.
        $grouped = IntercityBooking::query()
            ->where('status', IntercityBookingStatus::Pending)
            ->whereNull('trip_id')
            ->with(['route.fromRegion', 'route.toRegion'])
            ->get()
            ->groupBy(fn ($b) => $b->route_id.'_'.$b->departure_date->toDateString());

        $offers = [];
        foreach ($grouped as $key => $bookings) {
            $first = $bookings->first();
            $route = $first->route;
            if ($route === null) {
                continue;
            }
            $totalSeats = $bookings->sum('seats_count');
            if ($totalSeats >= $route->max_seats) {
                $offers[] = [
                    'route_id' => $route->id,
                    'from_region' => $route->fromRegion?->name,
                    'to_region' => $route->toRegion?->name,
                    'departure_date' => $first->departure_date->toDateString(),
                    'max_seats' => $route->max_seats,
                    'price_per_seat' => $route->price_per_seat,
                    'total_revenue' => $route->max_seats * $route->price_per_seat,
                    'passengers_count' => $bookings->count(),
                ];
            }
        }

        return response()->json(['offers' => $offers]);
    }

    public function accept(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'route_id' => ['required', 'integer', 'exists:intercity_routes,id'],
            'departure_date' => ['required', 'date'],
        ]);

        try {
            $route = IntercityRoute::findOrFail($validated['route_id']);
            $trip = $this->service->acceptByDriver(
                driver: $request->user(),
                route: $route,
                departureDate: Carbon::parse($validated['departure_date']),
            );
            $trip->load(['route.fromRegion', 'route.toRegion', 'bookings']);

            return (new IntercityTripResource($trip))
                ->response()
                ->setStatusCode(201);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Активный trip водителя (matched/en_route) с пассажирами.
     */
    public function activeTrip(Request $request): JsonResponse|IntercityTripResource
    {
        $trip = IntercityTrip::query()
            ->where('driver_id', $request->user()->id)
            ->active()
            ->with(['route.fromRegion', 'route.toRegion', 'bookings'])
            ->latest()
            ->first();

        if ($trip === null) {
            return response()->json(['message' => 'No active intercity trip.'], 404);
        }

        return new IntercityTripResource($trip);
    }

    public function start(Request $request, IntercityTrip $trip): JsonResponse|IntercityTripResource
    {
        try {
            $updated = $this->service->startTrip($trip, $request->user());
            $updated->load(['route.fromRegion', 'route.toRegion', 'bookings']);

            return new IntercityTripResource($updated);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function complete(Request $request, IntercityTrip $trip): JsonResponse|IntercityTripResource
    {
        try {
            $updated = $this->service->completeTrip($trip, $request->user());
            $updated->load(['route.fromRegion', 'route.toRegion', 'bookings']);

            return new IntercityTripResource($updated);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}
