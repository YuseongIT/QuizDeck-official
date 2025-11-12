<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class IsTeacher
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        if ($user && $user->role === 'teacher') {
            return $next($request);
        }
        return response()->json(['error' => 'Unauthorized'], 403);
    }
}
