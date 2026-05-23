<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('driver_profiles', function (Blueprint $table) {
            // KYC document paths — relative to the `local` (private) disk:
            // `driver-docs/{user_id}/{type}.{ext}`. We never expose the
            // raw filesystem path to JS / external callers; admin views
            // them through a guarded streaming route, never as public
            // /storage/ URLs.
            $table->string('passport_front_path')->nullable();
            $table->string('passport_back_path')->nullable();
            $table->string('license_path')->nullable();
            $table->string('driver_photo_path')->nullable();
            $table->string('car_photo_path')->nullable();
            $table->string('insurance_path')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('driver_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'passport_front_path',
                'passport_back_path',
                'license_path',
                'driver_photo_path',
                'car_photo_path',
                'insurance_path',
            ]);
        });
    }
};
