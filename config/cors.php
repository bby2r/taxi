<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'broadcasting/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    // Mobile apps don't send Origin (it's null), so wildcard origins
    // are unnecessary for our actual users. Restricting to known
    // first-party web origins blocks browser-based exfiltration if a
    // Sanctum token ever leaks into a malicious site. To add staging
    // / preview origins, append to this list.
    'allowed_origins' => array_filter(
        explode(',', (string) env('CORS_ALLOWED_ORIGINS', 'https://aliftaxi.kg'))
    ),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'ngrok-skip-browser-warning'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
