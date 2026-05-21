<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Free-text note client adds at order-create time so the
            // driver knows landmarks ("у красного магазина"), wait
            // expectations ("подождите 2 минуты"), or special needs
            // ("большой багаж"). Nullable — most orders won't have one.
            $table->string('client_comment', 255)->nullable()->after('dropoff_address');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('client_comment');
        });
    }
};
