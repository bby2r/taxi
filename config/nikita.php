<?php

return [
    'login' => env('NIKITA_LOGIN'),
    'password' => env('NIKITA_PASSWORD'),
    'sender' => env('NIKITA_SENDER', 'SMSPRO.KG'),
    'message_template' => env('NIKITA_MESSAGE_TEMPLATE', 'Alif Taxi: код подтверждения {code}. Никому не сообщайте.'),
    'api_url' => env('NIKITA_API_URL', 'https://smspro.nikita.kg/api/message'),
    'enabled' => env('NIKITA_ENABLED', false),
];
