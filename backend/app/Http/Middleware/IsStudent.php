<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class IsStudent
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        if ($user && $user->role === 'student') {
            return $next($request);
        }
        return response()->json(['error' => 'Unauthorized'], 403);
    }
}
