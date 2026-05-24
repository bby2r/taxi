<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\V1\RegionResource;
use App\Models\Region;
use App\Models\RegionRoute;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class RegionController extends Controller
{
    /**
     * Список активных районов для пикеров «Откуда» / «Куда».
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
     * Матрица цен «откуда × куда» для клиента. Клиент кеширует её
     * один раз и считает цену любой пары локально (без сетевого
     * запроса на каждый тап пикера). round_trip_surcharge_percent
     * приходит в той же ручке — экономит ещё один HTTP.
     */
    public function tariffs(): JsonResponse
    {
        $routes = RegionRoute::query()
            ->get(['from_region_id', 'to_region_id', 'day_price', 'night_price'])
            ->map(fn ($r) => [
                'from_region_id' => $r->from_region_id,
                'to_region_id' => $r->to_region_id,
                'day_price' => (int) $r->day_price,
                'night_price' => (int) $r->night_price,
            ])
            ->values();

        return response()->json([
            'routes' => $routes,
            'round_trip_surcharge_percent' => (int) Setting::getValue('round_trip_surcharge_percent', 70),
        ]);
    }
}
