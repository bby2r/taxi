<?php

return [
    'access_token' => env('WHATSAPP_ACCESS_TOKEN'),
    'phone_number_id' => env('WHATSAPP_PHONE_NUMBER_ID'),
    'template_name' => env('WHATSAPP_TEMPLATE_NAME', 'otp_login'),
    'language_code' => env('WHATSAPP_LANGUAGE_CODE', 'ru'),
    'api_version' => env('WHATSAPP_API_VERSION', 'v21.0'),
    'enabled' => env('WHATSAPP_ENABLED', false),
];
