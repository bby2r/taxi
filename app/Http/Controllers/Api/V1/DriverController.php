<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\UpdateLocationRequest;
use App\Http\Resources\V1\DriverChangeRequestResource;
use App\Http\Resources\V1\OrderResource;
use App\Http\Resources\V1\UserResource;
use App\Models\Order;
use App\Services\OrderService;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DriverController extends Controller
{
    public function __construct(private readonly OrderService $orderService) {}

    /**
     * Set the driver as online and update their location.
     */
    public function goOnline(UpdateLocationRequest $request): JsonResponse|UserResource
    {
        $profile = $request->user()->driverProfile;

        if (! $profile) {
            return response()->json(['message' => 'Driver profile not found.'], 404);
        }

        $profile->update([
            'is_online' => true,
            'latitude' => $request->validated('latitude'),
            'longitude' => $request->validated('longitude'),
            'location_updated_at' => now(),
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

        $profile->update([
            'latitude' => $request->validated('latitude'),
            'longitude' => $request->validated('longitude'),
            'location_updated_at' => now(),
        ]);

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
        $this->orderService->declineOrder($order, $request->user());

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
     */
    public function completeOrder(Request $request, Order $order): JsonResponse
    {
        try {
            $order = $this->orderService->completeOrder($order, $request->user());
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
        $order = Order::forDriver($request->user()->id)
            ->active()
            ->with(['client', 'driver.driverProfile'])
            ->first();

        if (! $order) {
            return response()->json(['message' => 'No active order found.'], 404);
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
