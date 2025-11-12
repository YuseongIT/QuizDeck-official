<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class IsAdmin
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        if (!$user || !$user->is_admin || $user->role !== 'teacher') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        return $next($request);
    }
}
