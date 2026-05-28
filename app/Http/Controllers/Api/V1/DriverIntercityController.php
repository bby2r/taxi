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

    /**
     * Открытые slot'ы из region'а где водитель сейчас находится (GPS).
     * Те где он уже claim'нул другой trip активный — не показываем
     * (нельзя claim'нуть пока есть активный).
     */
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

        // Фильтр по локации водителя. Свежий GPS из запроса перебивает
        // profile.latitude/longitude — последнее обновляется только на
        // линии и устаревает когда водитель сменил район offline.
        $lat = $validated['latitude'] ?? $user->driverProfile?->latitude;
        $lng = $validated['longitude'] ?? $user->driverProfile?->longitude;

        // Без координат показывать всё подряд опасно — водитель из
        // Таласа увидит покровские slot'ы. Лучше пустой список +
        // подсказка в UI «включите геолокацию» чем показывать чужое.
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

        return response()->json([
            'offers' => $slots->map(fn (IntercityTrip $slot) => $this->slotToOfferArray($slot))->all(),
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

    public function close(Request $request, IntercityTrip $trip): JsonResponse|IntercityTripResource
    {
        try {
            $updated = $this->service->closeSlot($trip, $request->user());
            $updated->load(['route.fromRegion', 'route.toRegion', 'bookings']);

            return new IntercityTripResource($updated);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function cancel(Request $request, IntercityTrip $trip): JsonResponse|IntercityTripResource
    {
        try {
            $updated = $this->service->cancelTripByDriver($trip, $request->user());
            $updated->load(['route.fromRegion', 'route.toRegion', 'bookings']);

            return new IntercityTripResource($updated);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
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

    /**
     * @return array<string, mixed>
     */
    private function slotToOfferArray(IntercityTrip $slot): array
    {
        $bookedSeats = (int) IntercityBooking::query()
            ->where('trip_id', $slot->id)
            ->whereIn('status', [
                IntercityBookingStatus::Matched,
                IntercityBookingStatus::EnRoute,
            ])
            ->sum('seats_count');

        return [
            'trip_id' => $slot->id,
            'from_region' => $slot->route?->fromRegion?->name,
            'to_region' => $slot->route?->toRegion?->name,
            'departure_at' => $slot->departure_at?->toISOString(),
            'max_seats' => $slot->max_seats,
            'price_per_seat' => $slot->price_per_seat,
            'booked_seats' => $bookedSeats,
            'total_revenue' => $slot->max_seats * $slot->price_per_seat,
        ];
    }
}
