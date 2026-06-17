<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\V1\RegionResource;
use App\Models\Region;
use App\Models\RegionRoute;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class RegionController extends Controller
{
    /**
     * Список активных районов. Используется в межсёлами-модалке
     * как пикер «Куда» (включая destination-only регионы без координат).
     */
    public function index(): AnonymousResourceCollection
    {
        $regions = Region::active()
            ->service()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return RegionResource::collection($regions);
    }

    /**
     * Тарифы + определение района по GPS клиента.
     *
     * Если переданы latitude/longitude — сервер определяет ближайший
     * сервисный район (с координатами) в радиусе district_detection_max_km
     * и возвращает его. in_service_area=true ⇒ клиент может заказывать.
     * in_service_area=false ⇒ клиент вне зоны обслуживания, надо
     * показать «Сервис недоступен».
     *
     * Если GPS не передан — возвращаем только матрицу без detection,
     * клиент покажет лоадер пока ждёт GPS.
     */
    public function tariffs(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $routes = RegionRoute::query()
            ->get(['from_region_id', 'to_region_id', 'day_price', 'night_price'])
            ->map(fn ($r) => [
                'from_region_id' => $r->from_region_id,
                'to_region_id' => $r->to_region_id,
                'day_price' => (int) $r->day_price,
                'night_price' => (int) $r->night_price,
            ])
            ->values();

        $isDemo = $request->user()?->isDemo() === true;
        [$detectedVillage, $inServiceArea] = $this->detectVillage(
            isset($validated['latitude']) ? (float) $validated['latitude'] : null,
            isset($validated['longitude']) ? (float) $validated['longitude'] : null,
            $isDemo,
        );

        return response()->json([
            'routes' => $routes,
            'round_trip_surcharge_percent' => (int) Setting::getValue('round_trip_surcharge_percent', 70),
            'detected_village' => $detectedVillage,
            'in_service_area' => $inServiceArea,
        ]);
    }

    /**
     * @return array{0: array{id: int, name: string}|null, 1: bool|null}
     */
    private function detectVillage(?float $lat, ?float $lon, bool $isDemo): array
    {
        if ($lat !== null && $lon !== null) {
            $village = Region::findNearestByCoordinates($lat, $lon, Region::detectionMaxKm());
            if ($village !== null) {
                return [['id' => $village->id, 'name' => $village->name], true];
            }
        }

        // Demo-юзер (ревьюер) без GPS-fix или вне зоны — fallback на первое
        // сервисное село, чтобы UI пустил его в экран заказа. Реальные
        // юзеры вне зоны получают inServiceArea=false.
        if ($isDemo) {
            $fallback = Region::active()->service()->orderBy('sort_order')->first();
            if ($fallback !== null) {
                return [['id' => $fallback->id, 'name' => $fallback->name], true];
            }
        }

        if ($lat === null || $lon === null) {
            return [null, null];
        }

        return [null, false];
    }
}
