<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RegionRoute extends Model
{
    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'from_region_id',
        'to_region_id',
        'day_price',
        'night_price',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'day_price' => 'integer',
            'night_price' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Region, $this>
     */
    public function fromRegion(): BelongsTo
    {
        return $this->belongsTo(Region::class, 'from_region_id');
    }

    /**
     * @return BelongsTo<Region, $this>
     */
    public function toRegion(): BelongsTo
    {
        return $this->belongsTo(Region::class, 'to_region_id');
    }
}
