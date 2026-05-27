<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CreateIntercityBookingRequest;
use App\Http\Resources\V1\IntercityBookingResource;
use App\Http\Resources\V1\IntercityRouteResource;
use App\Models\IntercityBooking;
use App\Models\IntercityRoute;
use App\Models\Region;
use App\Services\IntercityService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use RuntimeException;

class ClientIntercityController extends Controller
{
    public function __construct(private readonly IntercityService $service) {}

    /**
     * Список доступных маршрутов от района клиента (определяется по
     * GPS). Без GPS возвращаем все активные маршруты.
     */
    public function routes(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $query = IntercityRoute::query()
            ->active()
            ->with(['fromRegion', 'toRegion']);

        if (isset($validated['latitude'], $validated['longitude'])) {
            $fromRegion = Region::findNearestByCoordinates(
                (float) $validated['latitude'],
                (float) $validated['longitude'],
                Region::detectionMaxKm(),
            );
            if ($fromRegion !== null) {
                $query->where('from_region_id', $fromRegion->id);
            }
        }

        $routes = $query->orderBy('sort_order')->orderBy('id')->get();

        return IntercityRouteResource::collection($routes);
    }

    public function store(CreateIntercityBookingRequest $request): JsonResponse
    {
        try {
            $route = IntercityRoute::findOrFail($request->validated('route_id'));
            $booking = $this->service->createBooking(
                client: $request->user(),
                route: $route,
                departureDate: Carbon::parse($request->validated('departure_date')),
                seatsCount: (int) $request->validated('seats_count'),
                pickupAddress: $request->validated('pickup_address'),
            );

            $booking->load(['route.fromRegion', 'route.toRegion', 'trip']);

            return (new IntercityBookingResource($booking))
                ->response()
                ->setStatusCode(201);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Текущая активная бронь клиента (pending/matched/en_route).
     */
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
