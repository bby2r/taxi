<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pivot к slot-модели:
     *
     * - driver_id теперь nullable (slot создаётся cron'ом пустым, водитель claim'ит позже)
     * - driver_name/phone/car_model/car_number nullable по той же причине
     * - schedule_id — FK на шаблон расписания (NULL для ad-hoc слотов)
     * - departure_at — точное время выезда (не только дата)
     * - is_closed — водитель закрыл слот вручную (взял уличного пассажира)
     */
    public function up(): void
    {
        Schema::table('intercity_trips', function (Blueprint $table) {
            $table->foreignId('schedule_id')->nullable()->after('route_id')
                ->constrained('intercity_route_schedules')->nullOnDelete();
            $table->timestamp('departure_at')->nullable()->after('departure_date');
            $table->boolean('is_closed')->default(false)->after('status');
        });

        // driver_id и snapshot-колонки сделаем nullable отдельным шагом
        // через raw — Laravel ALTER + foreign key вместе с changes
        // часто требуют doctrine/dbal, проще SQL напрямую.
        Schema::table('intercity_trips', function (Blueprint $table) {
            $table->foreignId('driver_id')->nullable()->change();
            $table->string('driver_name')->nullable()->change();
            $table->string('driver_phone')->nullable()->change();
            $table->string('car_model')->nullable()->change();
            $table->string('car_number')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('intercity_trips', function (Blueprint $table) {
            $table->dropForeign(['schedule_id']);
            $table->dropColumn(['schedule_id', 'departure_at', 'is_closed']);
        });
    }
};
