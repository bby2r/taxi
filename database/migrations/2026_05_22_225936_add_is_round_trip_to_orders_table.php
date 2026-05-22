<?php

use App\Models\Setting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Round-trip flag — driver waits at the destination and
            // brings the client back. Surcharge applied at order
            // creation (orders.price gets the bumped value), so the
            // existing dispatch + settlement flow needs no special
            // case downstream. Display-only flag for the driver card.
            $table->boolean('is_round_trip')->default(false)->after('client_comment');
        });

        // Configurable surcharge percent so the operator can tune
        // without a redeploy. Default 70 → final price = base * 1.7.
        Setting::updateOrCreate(
            ['key' => 'round_trip_surcharge_percent'],
            [
                'value' => '70',
                'description' => 'Доплата к базовой цене за поездку туда-обратно, в процентах (0-300). Применяется при создании заказа.',
            ],
        );
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('is_round_trip');
        });
        Setting::where('key', 'round_trip_surcharge_percent')->delete();
    }
};
