<?php

namespace App\Models;

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
    'sort_order',
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
            'sort_order' => 'integer',
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
