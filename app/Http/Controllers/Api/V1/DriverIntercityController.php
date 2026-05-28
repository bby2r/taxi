<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\IntercityBookingStatus;
use App\Enums\IntercityTripStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\V1\IntercityTripResource;
use App\Models\IntercityBooking;
use App\Models\IntercityTrip;
use App\Models\Region;
use App\Services\IntercityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class DriverIntercityController extends Controller
{
    public function __construct(private readonly IntercityService $service) {}

    public function available(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $user = $request->user();
        $user->loadMissing('driverProfile');

        if ($user->driverProfile?->accepts_intercity !== true) {
            return response()->json(['offers' => []]);
        }

        $hasActive = IntercityTrip::query()
            ->where('driver_id', $user->id)
            ->active()
            ->exists();
        if ($hasActive) {
            return response()->json(['offers' => []]);
        }

        // Свежий GPS из запроса перебивает profile coords — profile
        // обновляется только на линии и устаревает offline.
        $lat = $validated['latitude'] ?? $user->driverProfile?->latitude;
        $lng = $validated['longitude'] ?? $user->driverProfile?->longitude;

        // Без координат показать всё опасно — водитель из Таласа
        // увидит покровские slot'ы.
        if ($lat === null || $lng === null) {
            return response()->json(['offers' => []]);
        }

        $region = Region::findNearestByCoordinates(
            (float) $lat,
            (float) $lng,
            Region::detectionMaxKm(),
        );
        if ($region === null) {
            return response()->json(['offers' => []]);
        }

        $slots = IntercityTrip::query()
            ->where('status', IntercityTripStatus::Open)
            ->where('departure_at', '>', now())
            ->whereHas('route', fn ($q) => $q->where('from_region_id', $region->id))
            ->with(['route.fromRegion', 'route.toRegion'])
            ->orderBy('departure_at')
            ->limit(50)
            ->get();

        $bookedByTrip = IntercityBooking::query()
            ->whereIn('trip_id', $slots->pluck('id')->all())
            ->whereIn('status', [
                IntercityBookingStatus::Matched,
                IntercityBookingStatus::EnRoute,
            ])
            ->selectRaw('trip_id, SUM(seats_count) as total')
            ->groupBy('trip_id')
            ->pluck('total', 'trip_id');

        return response()->json([
            'offers' => $slots->map(fn (IntercityTrip $slot) => [
                'trip_id' => $slot->id,
                'from_region' => $slot->route?->fromRegion?->name,
                'to_region' => $slot->route?->toRegion?->name,
                'departure_at' => $slot->departure_at?->toISOString(),
                'max_seats' => $slot->max_seats,
                'price_per_seat' => $slot->price_per_seat,
                'booked_seats' => (int) ($bookedByTrip[$slot->id] ?? 0),
                'total_revenue' => $slot->max_seats * $slot->price_per_seat,
            ])->all(),
        ]);
    }

    public function claim(Request $request, IntercityTrip $trip): JsonResponse|IntercityTripResource
    {
        try {
            $claimed = $this->service->claimSlot($trip, $request->user());
            $claimed->load(['route.fromRegion', 'route.toRegion', 'bookings']);

            return new IntercityTripResource($claimed);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Активный slot водителя (claimed/ready/en_route) с пассажирами.
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

    public function noShow(Request $request, IntercityBooking $booking): JsonResponse
    {
        try {
            $updated = $this->service->markPassengerNoShow($booking, $request->user());

            return response()->json([
                'id' => $updated->id,
                'status' => $updated->status->value,
            ]);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}
