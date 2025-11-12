<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Course;
use Illuminate\Http\Request;

class ActivityController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user->role === 'teacher') {
            $activity = ActivityLog::whereHas('quiz.course', function ($q) use ($user) {
                    $q->where('teacher_id', $user->id);
                })
                ->with(['user:id,username', 'quiz:id,title,course_id', 'quiz.course:id,course_name,course_code'])
                ->orderByDesc('completed_at')
                ->limit(50)
                ->get();
        } else {
            $activity = ActivityLog::where('user_id', $user->id)
                ->with(['quiz:id,title,course_id', 'quiz.course:id,course_name,course_code'])
                ->orderByDesc('completed_at')
                ->limit(50)
                ->get();
        }

        return response()->json($activity);
    }
}
