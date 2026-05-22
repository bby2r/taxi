<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\DeclineReason;
use App\Enums\DriverCancellationReason;
use App\Enums\OrderStatus;
use App\Events\DriverLocationUpdated;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\UpdateLocationRequest;
use App\Http\Resources\V1\DriverChangeRequestResource;
use App\Http\Resources\V1\OrderResource;
use App\Http\Resources\V1\UserResource;
use App\Models\Order;
use App\Services\DriverBalanceService;
use App\Services\OrderService;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DriverController extends Controller
{
    public function __construct(
        private readonly OrderService $orderService,
        private readonly DriverBalanceService $balanceService,
    ) {}

    /**
     * Set the driver as online and update their location.
     */
    public function goOnline(UpdateLocationRequest $request): JsonResponse|UserResource
    {
        $profile = $request->user()->driverProfile;

        if (! $profile) {
            return response()->json(['message' => 'Driver profile not found.'], 404);
        }

        if ($profile->isBlocked()) {
            return response()->json([
                'message' => 'Вы временно заблокированы за частые отказы. Дождитесь окончания блокировки или обратитесь в поддержку.',
                'blocked_until' => $profile->blocked_until?->toISOString(),
            ], 423);
        }

        $profile->update([
            'is_online' => true,
            'latitude' => $request->validated('latitude'),
            'longitude' => $request->validated('longitude'),
            'location_updated_at' => now(),
            'shift_declines_count' => 0,
        ]);

        $request->user()->load('driverProfile');

        return new UserResource($request->user());
    }

    /**
     * Set the driver as offline.
     */
    public function goOffline(Request $request): JsonResponse|UserResource
    {
        $profile = $request->user()->driverProfile;

        if (! $profile) {
            return response()->json(['message' => 'Driver profile not found.'], 404);
        }

        $profile->update(['is_online' => false]);

        $request->user()->load('driverProfile');

        return new UserResource($request->user());
    }

    /**
     * Update the driver's current location.
     */
    public function updateLocation(UpdateLocationRequest $request): JsonResponse|UserResource
    {
        $profile = $request->user()->driverProfile;

        if (! $profile) {
            return response()->json(['message' => 'Driver profile not found.'], 404);
        }

        $latitude = (float) $request->validated('latitude');
        $longitude = (float) $request->validated('longitude');

        $profile->update([
            'latitude' => $latitude,
            'longitude' => $longitude,
            'location_updated_at' => now(),
        ]);

        $activeOrder = Order::query()
            ->where('driver_id', $request->user()->id)
            ->whereIn('status', [OrderStatus::Accepted, OrderStatus::Arrived, OrderStatus::InProgress])
            ->first();

        if ($activeOrder) {
            broadcast(new DriverLocationUpdated($activeOrder, $latitude, $longitude))->toOthers();
        }

        $request->user()->load('driverProfile');

        return new UserResource($request->user());
    }

    /**
     * Accept an order offered to the driver.
     */
    public function acceptOrder(Request $request, Order $order): JsonResponse
    {
        try {
            $order = $this->orderService->acceptOrder($order, $request->user());
            $order->load(['client', 'driver.driverProfile']);

            return (new OrderResource($order))->response();
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Decline an order offered to the driver.
     */
    public function declineOrder(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'in:'.implode(',', DeclineReason::selectable())],
        ]);

        $this->orderService->declineOrder($order, $request->user(), $validated['reason']);

        return response()->json(['message' => 'Order declined.']);
    }

    /**
     * Mark that the driver has arrived at the pickup location.
     */
    public function arrived(Request $request, Order $order): JsonResponse
    {
        try {
            $order = $this->orderService->driverArrived($order, $request->user());
            $order->load(['client', 'driver.driverProfile']);

            return (new OrderResource($order))->response();
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Start the ride for the given order.
     */
    public function startRide(Request $request, Order $order): JsonResponse
    {
        try {
            $order = $this->orderService->startRide($order, $request->user());
            $order->load(['client', 'driver.driverProfile']);

            return (new OrderResource($order))->response();
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Complete the given order.
     *
     * Accepts an optional `one_way_fallback` boolean — driver flips it on
     * when the client booked round-trip but didn't come back, so the
     * surcharge is rolled out of the price + commission for fairness.
     */
    public function completeOrder(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'one_way_fallback' => ['sometimes', 'boolean'],
        ]);

        try {
            $order = $this->orderService->completeOrder(
                $order,
                $request->user(),
                (bool) ($validated['one_way_fallback'] ?? false),
            );
            $order->load(['client', 'driver.driverProfile']);

            return (new OrderResource($order))->response();
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Cancel the active order from the driver side (client no-show etc.).
     */
    public function cancelOrder(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'in:'.implode(',', DriverCancellationReason::selectable())],
        ]);

        try {
            $order = $this->orderService->cancelByDriver($order, $request->user(), $validated['reason']);
            $order->load(['client', 'driver.driverProfile']);

            return (new OrderResource($order))->response();
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * List all orders for the authenticated driver.
     */
    public function orders(Request $request): AnonymousResourceCollection
    {
        $orders = Order::forDriver($request->user()->id)
            ->with(['client', 'driver.driverProfile'])
            ->latest()
            ->paginate(20);

        return OrderResource::collection($orders);
    }

    /**
     * Get the currently active order for the authenticated driver.
     */
    public function activeOrder(Request $request): JsonResponse|OrderResource
    {
        $userId = $request->user()->id;

        // ACTIVE means truly assigned-to-driver (accepted / arrived / in_progress).
        // Offers (status=searching, offered_driver_id=me) live behind
        // /orders/pending-offer — mixing them in here breaks the driver
        // app's cold-start restore because the client maps 'searching' to
        // no phase and silently returns before consuming the queued
        // deep-link accept action.
        $order = Order::where('driver_id', $userId)
            ->whereIn('status', [
                OrderStatus::Accepted,
                OrderStatus::Arrived,
                OrderStatus::InProgress,
            ])
            ->with(['client', 'driver.driverProfile'])
            ->first();

        if (! $order) {
            return response()->json(['message' => 'No active order found.'], 404);
        }

        return new OrderResource($order);
    }

    /**
     * Get the order currently offered to the authenticated driver (for polling).
     */
    public function pendingOffer(Request $request): JsonResponse|OrderResource
    {
        $order = Order::where('offered_driver_id', $request->user()->id)
            ->where('status', OrderStatus::Searching)
            ->with(['client'])
            ->first();

        if (! $order) {
            return response()->json(['message' => 'No pending offer.'], 404);
        }

        return new OrderResource($order);
    }

    /**
     * Get the authenticated driver's profile with pending change requests.
     */
    public function profile(Request $request): UserResource
    {
        $user = $request->user();
        $user->load('driverProfile');
        $pendingChanges = $user->changeRequests()->pending()->get();

        return (new UserResource($user))->additional([
            'pending_changes' => DriverChangeRequestResource::collection($pendingChanges),
        ]);
    }

    /**
     * Earnings + commission summary for the driver mobile app
     * (today / week / month / total + current balance owed + recent
     * settlements).
     */
    public function balance(Request $request): JsonResponse
    {
        $summary = $this->balanceService->summary($request->user());

        return response()->json(['data' => $summary]);
    }

    /**
     * Get driver statistics (orders count and earnings).
     */
    public function stats(Request $request): JsonResponse
    {
        $driverId = $request->user()->id;

        $stats = fn (CarbonInterface $from) => Order::forDriver($driverId)
            ->where('status', OrderStatus::Completed)
            ->where('completed_at', '>=', $from)
            ->selectRaw('count(*) as orders, coalesce(sum(price), 0) as earnings')
            ->first();

        $today = $stats(today());
        $week = $stats(now()->startOfWeek());
        $month = $stats(now()->startOfMonth());
        $total = Order::forDriver($driverId)
            ->where('status', OrderStatus::Completed)
            ->selectRaw('count(*) as orders, coalesce(sum(price), 0) as earnings')
            ->first();

        return response()->json([
            'data' => [
                'today' => ['orders' => (int) $today->orders, 'earnings' => (int) $today->earnings],
                'week' => ['orders' => (int) $week->orders, 'earnings' => (int) $week->earnings],
                'month' => ['orders' => (int) $month->orders, 'earnings' => (int) $month->earnings],
                'total' => ['orders' => (int) $total->orders, 'earnings' => (int) $total->earnings],
            ],
        ]);
    }
}
