<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\IntercityBookingStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\V1\IntercityBookingResource;
use App\Models\IntercityBooking;
use App\Models\IntercityTrip;
use App\Models\Region;
use App\Services\IntercityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class ClientIntercityController extends Controller
{
    public function __construct(private readonly IntercityService $service) {}

    /**
     * Доступные slot'ы из района клиента (определяется по GPS).
     * Возвращаем только slot'ы:
     *   - status bookable (open или claimed, но не ready/en_route/cancelled)
     *   - не закрыт водителем (is_closed=false)
     *   - departure_at в будущем
     *   - есть свободные места
     */
    public function slots(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $query = IntercityTrip::query()
            ->bookable()
            ->where('departure_at', '>', now())
            ->with(['route.fromRegion', 'route.toRegion']);

        // Фильтр по локации клиента — показываем только slot'ы с
        // pickup в том же районе где он сейчас находится.
        if (isset($validated['latitude'], $validated['longitude'])) {
            $region = Region::findNearestByCoordinates(
                (float) $validated['latitude'],
                (float) $validated['longitude'],
                Region::detectionMaxKm(),
            );
            if ($region !== null) {
                $query->whereHas('route', fn ($q) => $q->where('from_region_id', $region->id));
            }
        }

        $slots = $query->orderBy('departure_at')->limit(50)->get();

        // Sum booked seats one shot for the page.
        $tripIds = $slots->pluck('id')->all();
        $bookedByTrip = IntercityBooking::query()
            ->whereIn('trip_id', $tripIds)
            ->whereIn('status', [
                IntercityBookingStatus::Matched,
                IntercityBookingStatus::EnRoute,
            ])
            ->selectRaw('trip_id, SUM(seats_count) as total')
            ->groupBy('trip_id')
            ->pluck('total', 'trip_id');

        return response()->json([
            'slots' => $slots->map(fn (IntercityTrip $slot) => [
                'trip_id' => $slot->id,
                'from_region' => $slot->route?->fromRegion?->name,
                'to_region' => $slot->route?->toRegion?->name,
                'departure_at' => $slot->departure_at?->toISOString(),
                'max_seats' => $slot->max_seats,
                'price_per_seat' => $slot->price_per_seat,
                'booked_seats' => (int) ($bookedByTrip[$slot->id] ?? 0),
                'has_driver' => $slot->driver_id !== null,
                'driver_name' => $slot->driver_name,
                'car_model' => $slot->car_model,
                'car_number' => $slot->car_number,
            ])->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'trip_id' => ['required', 'integer', 'exists:intercity_trips,id'],
            'seats_count' => ['required', 'integer', 'between:1,4'],
            'pickup_address' => ['nullable', 'string', 'max:500'],
        ]);

        try {
            $trip = IntercityTrip::findOrFail($validated['trip_id']);
            $booking = $this->service->createBooking(
                client: $request->user(),
                trip: $trip,
                seatsCount: (int) $validated['seats_count'],
                pickupAddress: $validated['pickup_address'] ?? null,
            );
            $booking->load(['route.fromRegion', 'route.toRegion', 'trip']);

            return (new IntercityBookingResource($booking))
                ->response()
                ->setStatusCode(201);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function active(Request $request): JsonResponse|IntercityBookingResource
    {
        $booking = IntercityBooking::query()
            ->where('client_id', $request->user()->id)
            ->active()
            ->with(['route.fromRegion', 'route.toRegion', 'trip'])
            ->latest()
            ->first();

        if ($booking === null) {
            return response()->json(['message' => 'No active intercity booking.'], 404);
        }

        if ($booking->trip_id !== null) {
            $booking->seats_booked_total = (int) IntercityBooking::query()
                ->where('trip_id', $booking->trip_id)
                ->whereIn('status', [
                    IntercityBookingStatus::Matched,
                    IntercityBookingStatus::EnRoute,
                ])
                ->sum('seats_count');
        }

        return new IntercityBookingResource($booking);
    }

    public function cancel(Request $request, IntercityBooking $booking): JsonResponse|IntercityBookingResource
    {
        try {
            $cancelled = $this->service->cancelBookingByClient($booking, $request->user());
            $cancelled->load(['route.fromRegion', 'route.toRegion', 'trip']);

            return new IntercityBookingResource($cancelled);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}
