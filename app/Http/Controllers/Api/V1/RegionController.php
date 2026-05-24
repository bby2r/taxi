<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\V1\RegionResource;
use App\Models\Region;
use App\Models\Setting;
use App\Services\TariffService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class RegionController extends Controller
{
    /**
     * List all active regions with their current prices.
     *
     * When the client passes latitude/longitude, prices reflect the
     * pickup→destination matrix (region_routes). Without GPS, prices
     * fall back to each region's flat destination tariff. The detected
     * pickup district is removed from the result — клиент не должен
     * видеть «межсёлами в свой же район» как опцию.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $pickupRegion = null;
        if (isset($validated['latitude'], $validated['longitude'])) {
            $pickupRegion = Region::findNearestByCoordinates(
                (float) $validated['latitude'],
                (float) $validated['longitude'],
            );
        }

        // Stash on the request so RegionResource can read it without
        // having to thread a parameter through Laravel's resource
        // collection plumbing (which doesn't take constructor args).
        $request->attributes->set('pickup_region', $pickupRegion);

        $regions = Region::active()
            ->when($pickupRegion !== null, fn ($q) => $q->where('id', '!=', $pickupRegion->id))
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return RegionResource::collection($regions)
            ->additional(['meta' => ['pickup_region_id' => $pickupRegion?->id]]);
    }

    /**
     * In-district tariff snapshot for the client home screen.
     *
     * When the client passes their current latitude/longitude, the server
     * resolves the nearest district centre and returns that district's
     * in-district price + name (Гео-A+). Without coords (or when no
     * region has centre coords configured) it falls back to the global
     * Settings tariff so older clients / offline-GPS launches still work.
     *
     * round_trip_surcharge_percent is bundled so the client can compute
     * the toggle preview locally with no extra round trip.
     */
    public function currentPrice(Request $request, TariffService $tariffService): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $district = null;
        $price = null;
        $gpsProvided = isset($validated['latitude'], $validated['longitude']);
        if ($gpsProvided) {
            $district = Region::findNearestByCoordinates(
                (float) $validated['latitude'],
                (float) $validated['longitude'],
                Region::detectionMaxKm(),
            );
            if ($district !== null) {
                $price = $district->getCurrentInDistrictPrice();
            }
        }

        // in_village_available signals the client whether to show the
        // «Заказ внутри села» button at all. False ⇒ клиент вне геозабора
        // (>2 км от любого района) и должен использовать межсёлами,
        // иначе сервер отклонит создание заказа.
        // Без GPS флаг true — старый клиент / клиент без локации видит
        // глобальный тариф и кнопку как раньше.
        $inVillageAvailable = ! $gpsProvided || $district !== null;

        return response()->json([
            'price' => $price ?? $tariffService->getCurrentPrice(),
            'round_trip_surcharge_percent' => (int) Setting::getValue('round_trip_surcharge_percent', 70),
            'district' => $district ? [
                'id' => $district->id,
                'name' => $district->name,
            ] : null,
            'in_village_available' => $inVillageAvailable,
        ]);
    }
}
