<?php

return [

    // Allow CORS for all API routes (and Sanctum's CSRF cookie route if used)
    // In production, you can narrow these paths if needed.
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // For development and LAN access, allow any origin so the API can be called
    // from any IP/domain or frontend (Blade, React, Vue, etc.).
    // Note: Wildcard origins are only compatible when supports_credentials=false.
    // For production, replace '*' with an explicit allowlist, e.g.:
    // 'allowed_origins' => [
    //     'https://app.example.com',
    //     'https://admin.example.com',
    // ],
    'allowed_origins' => ['*'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    // Expose Authorization so frontends can read tokens when needed.
    'exposed_headers' => ['Authorization'],

    'max_age' => 0,

    // Keep credentials off when using wildcard origins. If you need cookies or
    // Authorization headers with credentials, set this to true and replace
    // allowed_origins '*' with an explicit list of origins in production.
    'supports_credentials' => false,
];
