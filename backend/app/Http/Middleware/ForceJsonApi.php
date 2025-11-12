<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ForceJsonApi
{
    public function handle(Request $request, Closure $next)
    {
        try {
            // Force Accept header to JSON for API routes
            $request->headers->set('Accept', 'application/json');
            $response = $next($request);
            return $response;
        } catch (\Throwable $e) {
            $status = method_exists($e, 'getStatusCode') ? $e->getStatusCode() : 500;
            return response()->json([
                'message' => $e->getMessage(),
                'code' => $e->getCode(),
            ], $status);
        }
    }
}
