<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\V1\RegionResource;
use App\Models\Region;
use App\Services\TariffService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class RegionController extends Controller
{
    /**
     * List all active regions with their current prices.
     */
    public function index(): AnonymousResourceCollection
    {
        $regions = Region::active()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return RegionResource::collection($regions);
    }

    /**
     * Get the current global price (from settings).
     */
    public function currentPrice(TariffService $tariffService): JsonResponse
    {
        return response()->json([
            'price' => $tariffService->getCurrentPrice(),
        ]);
    }
}
