<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoDriverSeeder extends Seeder
{
    public function run(): void
    {
        // Бот-водитель для DemoOrderProgressionJob. Без него заказ от
        // demo-клиента застынет на «Поиск водителя». Идемпотентно —
        // updateOrCreate, чтобы повторный seed не дублировал.
        $driver = User::updateOrCreate(
            ['phone' => config('demo.driver_phone')],
            [
                'name' => config('demo.driver_name'),
                'role' => UserRole::Driver,
                'password' => Hash::make(str()->random(32)),
                'phone_verified_at' => now(),
            ],
        );

        $driver->driverProfile()->updateOrCreate(
            ['user_id' => $driver->id],
            [
                'car_model' => config('demo.driver_car_model'),
                'car_number' => config('demo.driver_car_number'),
                'is_online' => false,
            ],
        );
    }
}
