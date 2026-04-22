<?php

namespace App\Services;

use App\Models\DriverProfile;
use App\Models\Setting;
use Illuminate\Support\Collection;

class GeoService
{
    /**
     * Calculate distance between two points using Haversine formula.
     * Returns distance in kilometers.
     */
    public function distanceKm(
        float $lat1,
        float $lon1,
        float $lat2,
        float $lon2,
    ): float {
        $earthRadiusKm = 6371.0;

        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) * sin($dLat / 2)
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2))
            * sin($dLon / 2) * sin($dLon / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return round($earthRadiusKm * $c, 2);
    }

    /**
     * Find online drivers sorted by distance from a pickup point.
     * Excludes drivers in the $excludeIds array.
     * Returns a Collection of DriverProfile models with a `distance_km` attribute appended.
     *
     * @param  array<int>  $excludeIds  User IDs to exclude (declined drivers)
     * @return Collection<int, DriverProfile>
     */
    public function findNearestDrivers(
        float $pickupLat,
        float $pickupLon,
        array $excludeIds = [],
        int $limit = 10,
        ?float $maxRadiusKm = null,
    ): Collection {
        $maxRadiusKm ??= (float) Setting::getValue('max_search_radius_km', 10);

        $drivers = DriverProfile::online()
            ->withCoordinates()
            ->notBlocked()
            ->withoutActiveOrder()
            ->when(count($excludeIds) > 0, fn ($q) => $q->whereNotIn('user_id', $excludeIds))
            ->get();

        return $drivers->map(function (DriverProfile $profile) use ($pickupLat, $pickupLon) {
            $profile->distance_km = $this->distanceKm(
                $pickupLat,
                $pickupLon,
                (float) $profile->latitude,
                (float) $profile->longitude,
            );

            return $profile;
        })
            ->filter(fn (DriverProfile $profile) => $profile->distance_km <= $maxRadiusKm)
            ->sortBy('distance_km')
            ->take($limit)
            ->values();
    }
}
