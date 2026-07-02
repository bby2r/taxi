<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Cap `max_seats` to 4 (седан-класс) across intercity data. Валидация
     * контроллеров/blade уже была ограничена ранее — эта миграция
     * подчищает legacy-записи, созданные до правки, чтобы клиент не
     * видел «свободно 7 из 7» на будущих слотах, у которых schedule уже
     * пересчитан в админке до 4.
     *
     * Пассажиров не трогаем — прежняя валидация seats_count between:1,3
     * не давала забронировать больше 3 в одной брони, а сумма броней в
     * open/claimed/ready trip'ах никогда не пробивала 4.
     */
    public function up(): void
    {
        DB::table('intercity_routes')
            ->where('max_seats', '>', 4)
            ->update(['max_seats' => 4]);

        DB::table('intercity_route_schedules')
            ->where('max_seats', '>', 4)
            ->update(['max_seats' => 4]);

        DB::table('intercity_trips')
            ->whereIn('status', ['open', 'claimed', 'ready'])
            ->where('max_seats', '>', 4)
            ->update(['max_seats' => 4]);
    }

    public function down(): void
    {
        // Не-реверсируемо: оригинальные значения (7, 8, 15…) не хранились.
        // Восстанавливать легаси-конфигурацию из миграции всё равно
        // бессмысленно — админ должен явно завести новые значения.
    }
};
