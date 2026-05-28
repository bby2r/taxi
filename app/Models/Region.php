<?php

namespace App\Models;

use App\Services\GeoService;
use Carbon\Carbon;
use Database\Factories\RegionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'name',
    'is_active',
    'is_intercity_only',
    'sort_order',
    'center_latitude',
    'center_longitude',
])]
class Region extends Model
{
    /** @use HasFactory<RegionFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_intercity_only' => 'boolean',
            'sort_order' => 'integer',
            'center_latitude' => 'decimal:7',
            'center_longitude' => 'decimal:7',
        ];
    }

    /**
     * @param  Builder<Region>  $query
     * @return Builder<Region>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * «Сервисные» регионы — где живут клиенты и работают водители
     * на городском тарифе. Используется в матрице межсёлами и в
     * GET /regions для обычного такси, чтобы Бишкек/Талас не
     * засоряли пикер.
     *
     * @param  Builder<Region>  $query
     * @return Builder<Region>
     */
    public function scopeService(Builder $query): Builder
    {
        return $query->where('is_intercity_only', false);
    }

    /**
     * Цена поездки $from → $this. Берётся из матрицы region_routes.
     * Если в матрице ничего нет — возвращает 0 (оператор не заполнил
     * пару, и заказ работать не будет; админка предупреждает об этом).
     * Когда $from == $this — это in-village цена (диагональ матрицы).
     */
    public function priceFrom(Region $from, ?Carbon $at = null): int
    {
        $route = $this->incomingRoutes()
            ->where('from_region_id', $from->id)
            ->first();

        if ($route === null) {
            return 0;
        }

        $time = ($at ?? Carbon::now())->timezone('Asia/Bishkek');
        $isDay = $time->hour >= 7 && $time->hour <= 20;

        return $isDay ? $route->day_price : $route->night_price;
    }

    /**
     * Ближайший активный «сервисный» район — у которого заполнены
     * координаты центра. Если $maxKm задан и ближайший дальше → null
     * (клиент вне зоны обслуживания).
     *
     * Регионы без координат игнорируются: они «только направление»
     * для межсёлами, в них клиенты не живут.
     */
    public static function findNearestByCoordinates(
        float $latitude,
        float $longitude,
        ?float $maxKm = null,
    ): ?self {
        $regions = self::active()
            ->whereNotNull('center_latitude')
            ->whereNotNull('center_longitude')
            ->get();

        if ($regions->isEmpty()) {
            return null;
        }

        $nearest = null;
        $nearestDistance = INF;
        foreach ($regions as $region) {
            $distance = GeoService::haversineKm(
                $latitude,
                $longitude,
                (float) $region->center_latitude,
                (float) $region->center_longitude,
            );
            if ($distance < $nearestDistance) {
                $nearest = $region;
                $nearestDistance = $distance;
            }
        }

        if ($maxKm !== null && $nearestDistance > $maxKm) {
            return null;
        }

        return $nearest;
    }

    /**
     * Радиус геозабора (км) — клиент внутри этой дистанции от центра
     * района считается «в нём». Берётся из Settings, дефолт 5 км.
     */
    public static function detectionMaxKm(): float
    {
        return (float) Setting::getValue('district_detection_max_km', '5');
    }

    /**
     * @return HasMany<RegionRoute, $this>
     */
    public function outgoingRoutes(): HasMany
    {
        return $this->hasMany(RegionRoute::class, 'from_region_id');
    }

    /**
     * @return HasMany<RegionRoute, $this>
     */
    public function incomingRoutes(): HasMany
    {
        return $this->hasMany(RegionRoute::class, 'to_region_id');
    }
}
