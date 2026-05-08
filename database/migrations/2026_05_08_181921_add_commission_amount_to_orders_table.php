<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // KGS som — locked at completion time so changing the global rate
            // later doesn't retroactively rewrite historic ledgers.
            $table->unsignedInteger('commission_amount')->nullable()->after('cancellation_fee');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('commission_amount');
        });
    }
};
