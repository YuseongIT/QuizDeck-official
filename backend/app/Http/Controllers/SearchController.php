<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Course;
use App\Models\Quiz;
use App\Models\Enrollment;
use Illuminate\Support\Facades\Cache;

class SearchController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $type = $request->query('type');
        $query = trim((string) $request->query('query', ''));
        $filter = (string) $request->query('filter', '');

        if (!in_array($type, ['quiz','course'])) {
            return response()->json(['message' => 'Invalid type'], 422);
        }

        // Parse simple filter expressions like course:ID, friend:ID, teacher:ID
        $filterKey = null; $filterVal = null;
        if ($filter && str_contains($filter, ':')) {
            [$filterKey, $filterVal] = explode(':', $filter, 2);
        }

        $cacheKey = 'search:v1:u:' . ($user->id ?? 0) . ':t:' . $type . ':q:' . md5($query) . ':f:' . ($filter ?? '');
        $ttl = now()->addSeconds(45);

        $result = Cache::remember($cacheKey, $ttl, function () use ($type, $user, $query, $filterKey, $filterVal) {
            if ($type === 'course') {
                if ($user->role === 'teacher') {
                    $q = Course::where('teacher_id', $user->id);
                } else {
                    $courseIds = Enrollment::where('user_id', $user->id)->pluck('course_id');
                    $q = Course::whereIn('id', $courseIds);
                }
                if ($query !== '') {
                    $q->where(function ($qq) use ($query) {
                        $qq->where('course_name', 'LIKE', "%$query%")
                           ->orWhere('course_code', 'LIKE', "%$query%");
                    });
                }
                if ($filterKey === 'teacher' && is_numeric($filterVal)) {
                    $q->where('teacher_id', intval($filterVal));
                }
                return $q->orderBy('course_name')->limit(50)->get();
            }

            if ($user->role === 'teacher') {
                $courseIds = Course::where('teacher_id', $user->id)->pluck('id');
                $q = Quiz::whereIn('course_id', $courseIds)->orWhere('creator_id', $user->id);
            } else {
                $enrolledCourseIds = Enrollment::where('user_id', $user->id)->pluck('course_id');
                $q = Quiz::whereIn('course_id', $enrolledCourseIds)->orWhere('creator_id', $user->id);
            }
            if ($query !== '') {
                $q->where(function ($qq) use ($query) {
                    $qq->where('title', 'LIKE', "%$query%")
                       ->orWhere('description', 'LIKE', "%$query%");
                });
            }
            if ($filterKey === 'course' && is_numeric($filterVal)) {
                $q->where('course_id', intval($filterVal));
            }
            if ($filterKey === 'friend' && is_numeric($filterVal)) {
                $q->where('creator_id', intval($filterVal));
            }

            return $q->with(['course:id,course_name,course_code'])
                ->orderByDesc('created_at')
                ->limit(50)
                ->get();
        });

        return response()->json($result)->header('Cache-Control', 'private, max-age=30');
    }
}
