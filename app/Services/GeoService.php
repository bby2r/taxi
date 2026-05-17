<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Models\DriverProfile;
use App\Models\Order;
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
     *
     * Eligible drivers are those with no active order, plus (if pre-assign is
     * enabled) drivers in InProgress whose distance to their current dropoff
     * is below `pre_assign_distance_km`. This lets us hand a new order to a
     * driver who is just minutes from finishing the current one.
     *
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
        $preAssignKm = (float) Setting::getValue('pre_assign_distance_km', 1.5);
        // Drivers whose distance to pickup differs from the nearest one by
        // less than this radius are treated as equally close — within that
        // bucket the dispatcher prefers the driver with the fewest
        // completed rides today so income spreads instead of pooling on a
        // single driver who happens to be camping near the busy spots.
        $fairnessRadiusKm = (float) Setting::getValue('fairness_radius_km', 0.5);

        $drivers = DriverProfile::online()
            ->withCoordinates()
            ->notBlocked()
            ->with(['user' => function ($q) {
                $q->with(['driverOrders' => function ($q2) {
                    $q2->whereIn('status', [
                        OrderStatus::Accepted,
                        OrderStatus::Arrived,
                        OrderStatus::InProgress,
                    ]);
                }])
                    // Count completed rides today per driver so the
                    // tie-break sort doesn't need a second query per row.
                    ->withCount(['driverOrders as completed_today_count' => function ($q2) {
                        $q2->where('status', OrderStatus::Completed)
                            ->whereDate('completed_at', today());
                    }]);
            }])
            ->when(count($excludeIds) > 0, fn ($q) => $q->whereNotIn('user_id', $excludeIds))
            ->get();

        $byDistance = $drivers
            ->filter(fn (DriverProfile $profile) => $this->isEligible($profile, $preAssignKm))
            ->map(function (DriverProfile $profile) use ($pickupLat, $pickupLon) {
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
            ->values();

        if ($byDistance->isEmpty()) {
            return $byDistance;
        }

        // Tie-break the front of the list by today's ride count. The
        // nearest driver still wins outright when they're meaningfully
        // closer than the runners-up; otherwise the least-loaded of the
        // bucket gets the offer first. Drivers outside the bucket keep
        // their distance ranking — preserves "nearest first" for the
        // client whenever the distances meaningfully diverge.
        $nearestDistance = (float) $byDistance->first()->distance_km;
        $bucketThreshold = $nearestDistance + $fairnessRadiusKm;

        [$bucket, $rest] = $byDistance->partition(
            fn (DriverProfile $profile) => $profile->distance_km <= $bucketThreshold,
        );

        // Combine "fewer rides wins" (primary) with "closer wins"
        // (tie-break inside bucket). max_search_radius_km caps distance
        // at single digits, so multiplying ride count by 1000 guarantees
        // the lexicographic order even with floating-point distance.
        // Per-shift declines add a small weight so drivers cherry-picking
        // offers get deprioritised within their bucket — kinder than
        // the old hard-block-after-5-declines penalty (which sent
        // drivers offline for 2 h).
        $bucket = $bucket
            ->sortBy(function (DriverProfile $profile) {
                $ridesToday = (int) ($profile->user?->completed_today_count ?? 0);
                $shiftDeclines = (int) ($profile->shift_declines_count ?? 0);

                return $ridesToday * 1000
                    + $shiftDeclines * 100
                    + (float) $profile->distance_km;
            })
            ->values();

        return $bucket
            ->concat($rest)
            ->take($limit)
            ->values();
    }

    /**
     * A driver is eligible to receive a new offer if they have no active
     * order, or if pre-assign is enabled and their active ride is InProgress
     * with the driver already within `pre_assign_distance_km` of the dropoff.
     */
    private function isEligible(DriverProfile $profile, float $preAssignKm): bool
    {
        $active = $profile->user?->driverOrders->first();

        if ($active === null) {
            return true;
        }

        if ($preAssignKm <= 0) {
            return false;
        }

        if ($active->status !== OrderStatus::InProgress) {
            return false;
        }

        if ($active->dropoff_latitude === null || $active->dropoff_longitude === null) {
            return false;
        }

        $distanceToDropoff = $this->distanceKm(
            (float) $profile->latitude,
            (float) $profile->longitude,
            (float) $active->dropoff_latitude,
            (float) $active->dropoff_longitude,
        );

        return $distanceToDropoff <= $preAssignKm;
    }
}
