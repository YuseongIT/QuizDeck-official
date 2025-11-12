<?php

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustProxies as Middleware;
use Illuminate\Http\Request;

class TrustProxies extends Middleware
{
    /**
     * The trusted proxies for this application.
     *
     * You can set a comma-separated list of proxies in the TRUSTED_PROXIES env var,
     * e.g. "192.168.1.1,10.0.0.0/8". Use "*" to trust all (useful for ngrok/dev).
     */
    protected $proxies;

    /**
     * The headers that should be used to detect proxies.
     */
    protected $headers = Request::HEADER_X_FORWARDED_ALL;

    public function __construct()
    {
        $env = env('TRUSTED_PROXIES', '*');
        if ($env === '*' || $env === '"*"') {
            $this->proxies = '*';
        } else {
            $list = array_filter(array_map('trim', explode(',', (string) $env)));
            $this->proxies = $list ?: null;
        }
    }
}
