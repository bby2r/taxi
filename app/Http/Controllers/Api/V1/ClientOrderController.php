<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CreateOrderRequest;
use App\Http\Requests\Api\V1\CreateRegionalOrderRequest;
use App\Http\Resources\V1\OrderResource;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ClientOrderController extends Controller
{
    public function __construct(private readonly OrderService $orderService) {}

    /**
     * List all orders for the authenticated client.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orders = Order::forClient($request->user()->id)
            ->with(['client', 'driver.driverProfile', 'region'])
            ->latest()
            ->paginate(20);

        return OrderResource::collection($orders);
    }

    /**
     * Create a new order for the authenticated client.
     */
    public function store(CreateOrderRequest $request): JsonResponse
    {
        try {
            $order = $this->orderService->createOrder(
                client: $request->user(),
                pickupLat: (float) $request->validated('pickup_latitude'),
                pickupLon: (float) $request->validated('pickup_longitude'),
                pickupAddress: $request->validated('pickup_address'),
                dropoffLat: $request->validated('dropoff_latitude') ? (float) $request->validated('dropoff_latitude') : null,
                dropoffLon: $request->validated('dropoff_longitude') ? (float) $request->validated('dropoff_longitude') : null,
                dropoffAddress: $request->validated('dropoff_address'),
                clientComment: $request->validated('client_comment'),
            );

            $order->load(['client', 'driver.driverProfile']);

            return (new OrderResource($order))
                ->response()
                ->setStatusCode(201);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Create a new regional order for the authenticated client.
     */
    public function storeRegional(CreateRegionalOrderRequest $request): JsonResponse
    {
        try {
            $order = $this->orderService->createOrder(
                client: $request->user(),
                pickupLat: (float) $request->validated('pickup_latitude'),
                pickupLon: (float) $request->validated('pickup_longitude'),
                pickupAddress: $request->validated('pickup_address'),
                regionId: (int) $request->validated('region_id'),
                clientComment: $request->validated('client_comment'),
            );

            $order->load(['client', 'driver.driverProfile', 'region']);

            return (new OrderResource($order))
                ->response()
                ->setStatusCode(201);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Show a specific order belonging to the authenticated client.
     */
    public function show(Request $request, Order $order): JsonResponse|OrderResource
    {
        if ($order->client_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $order->load(['client', 'driver.driverProfile', 'region']);

        return new OrderResource($order);
    }

    /**
     * Cancel a specific order belonging to the authenticated client.
     */
    public function cancel(Request $request, Order $order): JsonResponse
    {
        if ($order->client_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        try {
            $order = $this->orderService->cancelOrder($order, 'client');
            $order->load(['client', 'driver.driverProfile', 'region']);

            return (new OrderResource($order))->response();
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Get the currently active order for the authenticated client.
     */
    public function active(Request $request): JsonResponse|OrderResource
    {
        $order = Order::forClient($request->user()->id)
            ->active()
            ->with(['client', 'driver.driverProfile', 'region'])
            ->first();

        if (! $order) {
            return response()->json(['message' => 'No active order found.'], 404);
        }

        return new OrderResource($order);
    }
}
