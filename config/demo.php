<?php

return [
    // Демо-аккаунт для App Store / Google Play review.
    // Ревьюер не получит SMS на свой американский номер, поэтому
    // фиксированный phone+code минует отправку и пускает в приложение.
    // Заказ от этого аккаунта проматывается DemoOrderProgressionJob
    // через бот-водителя независимо от GPS-зоны и наличия живых
    // водителей — чтобы Apple Reviewer увидел весь happy path.
    'phone' => env('DEMO_PHONE', '+996999999999'),
    'otp_code' => env('DEMO_OTP', '0000'),
    'driver_phone' => env('DEMO_DRIVER_PHONE', '+996999000001'),
    'driver_name' => env('DEMO_DRIVER_NAME', 'Демо Водитель'),
    'driver_car_model' => env('DEMO_DRIVER_CAR', 'Toyota Camry'),
    'driver_car_number' => env('DEMO_DRIVER_PLATE', '01KG777AAA'),
];
