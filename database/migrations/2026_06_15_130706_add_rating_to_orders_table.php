<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Оценка водителя клиентом после завершённой поездки.
            // 1-5 звёзд + теги-чипы («чисто», «вежливый», «опоздал»…)
            // как json-массив строк-ключей. Nullable — пока клиент не
            // оценил или поездка не завершена.
            $table->unsignedTinyInteger('rating')->nullable()->after('price');
            $table->json('feedback_tags')->nullable()->after('rating');
            $table->timestamp('rated_at')->nullable()->after('feedback_tags');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['rating', 'feedback_tags', 'rated_at']);
        });
    }
};
