<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CreateOrderRequest;
use App\Http\Requests\Api\V1\RateOrderRequest;
use App\Http\Resources\V1\OrderResource;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ClientOrderController extends Controller
{
    public function __construct(private readonly OrderService $orderService) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $orders = Order::forClient($request->user()->id)
            ->with(['client', 'driver.driverProfile', 'region', 'pickupRegion'])
            ->latest()
            ->paginate(20);

        return OrderResource::collection($orders);
    }

    /**
     * Создание заказа. Клиент явно выбрал from_region_id и to_region_id
     * (в-село = from==to, межсёлами = from!=to). Цена считается из
     * матрицы region_routes. GPS-определения района больше нет.
     */
    public function store(CreateOrderRequest $request): JsonResponse
    {
        try {
            $order = $this->orderService->createOrder(
                client: $request->user(),
                pickupLat: (float) $request->validated('pickup_latitude'),
                pickupLon: (float) $request->validated('pickup_longitude'),
                toRegionId: (int) $request->validated('to_region_id'),
                pickupAddress: $request->validated('pickup_address'),
                dropoffLat: $request->validated('dropoff_latitude') ? (float) $request->validated('dropoff_latitude') : null,
                dropoffLon: $request->validated('dropoff_longitude') ? (float) $request->validated('dropoff_longitude') : null,
                dropoffAddress: $request->validated('dropoff_address'),
                clientComment: $request->validated('client_comment'),
                isRoundTrip: (bool) $request->validated('is_round_trip', false),
            );

            $order->load(['client', 'driver.driverProfile', 'region', 'pickupRegion']);

            return (new OrderResource($order))
                ->response()
                ->setStatusCode(201);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function show(Request $request, Order $order): JsonResponse|OrderResource
    {
        if ($order->client_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $order->load(['client', 'driver.driverProfile', 'region', 'pickupRegion']);

        return new OrderResource($order);
    }

    public function cancel(Request $request, Order $order): JsonResponse
    {
        if ($order->client_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        try {
            $order = $this->orderService->cancelOrder($order, 'client');
            $order->load(['client', 'driver.driverProfile', 'region', 'pickupRegion']);

            return (new OrderResource($order))->response();
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Оценка водителя после завершённой поездки. Один раз на заказ —
     * повторная попытка возвращает 422. Только клиент-владелец, только
     * для completed-заказов с назначенным водителем (отменённые/в
     * процессе оценивать нельзя).
     */
    public function rate(RateOrderRequest $request, Order $order): JsonResponse|OrderResource
    {
        if ($order->client_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($order->status->value !== 'completed' || $order->driver_id === null) {
            return response()->json(['message' => 'Оценить можно только завершённую поездку.'], 422);
        }

        if ($order->rated_at !== null) {
            return response()->json(['message' => 'Вы уже оценили эту поездку.'], 422);
        }

        $order->update([
            'rating' => (int) $request->validated('rating'),
            'feedback_tags' => $request->validated('feedback_tags') ?? [],
            'rated_at' => now(),
        ]);

        $order->load(['client', 'driver.driverProfile', 'region', 'pickupRegion']);

        return new OrderResource($order);
    }

    public function active(Request $request): JsonResponse|OrderResource
    {
        $order = Order::forClient($request->user()->id)
            ->active()
            ->with(['client', 'driver.driverProfile', 'region', 'pickupRegion'])
            ->first();

        if (! $order) {
            return response()->json(['message' => 'No active order found.'], 404);
        }

        return new OrderResource($order);
    }
}
