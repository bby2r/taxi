<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('regions', function (Blueprint $table) {
            // Geographic centre of the district. Used to map a client's
            // current GPS to "which district am I in?" by nearest-centre
            // haversine. Nullable so existing destination-only regions
            // (legacy "Bishkek" etc.) keep working without coordinates.
            $table->decimal('center_latitude', 10, 7)->nullable();
            $table->decimal('center_longitude', 10, 7)->nullable();

            // In-district trip pricing — separate from the existing
            // day_price / night_price columns which represent INTER-
            // district pricing (Talas → Bishkek). When a client orders
            // a trip inside the district they're physically in, the
            // server uses the in-district numbers instead.
            $table->unsignedInteger('in_district_day_price')->nullable();
            $table->unsignedInteger('in_district_night_price')->nullable();
        });

        Schema::table('orders', function (Blueprint $table) {
            // Detected pickup district, separate from region_id which
            // still means "destination region for inter-district trip".
            // Kept distinct so existing is_inter_district checks
            // (OrderResource, dispatch FCM payload) keep their semantic.
            $table->foreignId('pickup_region_id')
                ->nullable()
                ->after('region_id')
                ->constrained('regions')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pickup_region_id');
        });

        Schema::table('regions', function (Blueprint $table) {
            $table->dropColumn([
                'center_latitude',
                'center_longitude',
                'in_district_day_price',
                'in_district_night_price',
            ]);
        });
    }
};
