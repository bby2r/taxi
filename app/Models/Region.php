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
    'day_price',
    'night_price',
    'in_district_day_price',
    'in_district_night_price',
    'center_latitude',
    'center_longitude',
    'is_active',
    'sort_order',
])]
class Region extends Model
{
    /** @use HasFactory<RegionFactory> */
    use HasFactory;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'day_price' => 'integer',
            'night_price' => 'integer',
            'in_district_day_price' => 'integer',
            'in_district_night_price' => 'integer',
            'center_latitude' => 'decimal:7',
            'center_longitude' => 'decimal:7',
            'sort_order' => 'integer',
        ];
    }

    /**
     * Scope to only active regions.
     *
     * @param  Builder<Region>  $query
     * @return Builder<Region>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Inter-district price (Talas → Bishkek style). Used when the
     * client picks a destination region for a trip OUT of their
     * current district.
     */
    public function getCurrentPrice(?Carbon $at = null): int
    {
        $time = ($at ?? Carbon::now())->timezone('Asia/Bishkek');
        $hour = $time->hour;

        if ($hour >= 7 && $hour <= 20) {
            return $this->day_price;
        }

        return $this->night_price;
    }

    /**
     * Pair-aware inter-district price ($from → $this). Looks up the
     * region_routes matrix; falls back to $this->getCurrentPrice() when
     * the pair has no override OR pickup district is unknown.
     *
     * Решает «Бакаирец и Кировец платят одну цену до Таласа»: оператор
     * заполняет только реально различающиеся направления, остальные
     * считаются по старой destination-flat цене.
     */
    public function priceFrom(?Region $from, ?Carbon $at = null): int
    {
        if ($from === null) {
            return $this->getCurrentPrice($at);
        }

        $route = $this->incomingRoutes()
            ->where('from_region_id', $from->id)
            ->first();

        if ($route === null) {
            return $this->getCurrentPrice($at);
        }

        $time = ($at ?? Carbon::now())->timezone('Asia/Bishkek');
        $isDay = $time->hour >= 7 && $time->hour <= 20;

        return $isDay ? $route->day_price : $route->night_price;
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

    /**
     * In-district price (trip stays inside this district). Falls back
     * to the global Setting('day_price') if the region hasn't had its
     * in-district prices set yet — keeps "regions with only legacy
     * destination prices" working out of the box.
     */
    public function getCurrentInDistrictPrice(?Carbon $at = null): int
    {
        $time = ($at ?? Carbon::now())->timezone('Asia/Bishkek');
        $hour = $time->hour;
        $isDay = $hour >= 7 && $hour <= 20;

        $configured = $isDay ? $this->in_district_day_price : $this->in_district_night_price;
        if ($configured !== null) {
            return (int) $configured;
        }

        // Fallback to the legacy global tariff so a newly-seeded region
        // without coords/in-district prices doesn't return 0 сом.
        $key = $isDay ? 'day_price' : 'night_price';
        $default = $isDay ? 80 : 120;

        return (int) Setting::getValue($key, (string) $default);
    }

    /**
     * Find the active region whose centre is geographically closest
     * to the given coordinates. Used by the dispatcher / client API
     * to map a pickup point to "which district is this in?" without
     * needing PostGIS polygons.
     *
     * Returns null when no active region has centre coords configured
     * (legacy data) OR when the nearest region's centre is farther than
     * $maxKm — caller decides: in-village flow blocks (geofence), while
     * inter-village flow passes null and falls back to destination flat.
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
     * Geofence radius for "are you inside a known village?" detection.
     * Sourced from Settings so the operator can tune without redeploy.
     */
    public static function detectionMaxKm(): float
    {
        return (float) Setting::getValue('district_detection_max_km', '2');
    }
}
