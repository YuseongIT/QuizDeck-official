<?php

namespace App\Http\Controllers;

use App\Models\QuizAttempt;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class GradesController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $quizId = $request->query('quiz_id');
        $ck = 'grades:index:v2:user:' . ($user->id ?? 0) . ':role:' . ($user->role ?? '') . ':quiz:' . (int)($quizId ?: 0);
        $rows = Cache::remember($ck, now()->addSeconds(45), function () use ($user, $quizId) {
            if ($user->role === 'teacher') {
                $q = DB::table('quiz_attempts as qa')
                    ->join('quizzes as q', 'qa.quiz_id', '=', 'q.id')
                    ->join('users as u', 'qa.student_id', '=', 'u.id')
                    ->leftJoin('courses as c', 'q.course_id', '=', 'c.id')
                    ->select('qa.id as attempt_id','q.id as quiz_id','q.title','u.id as student_id','u.name as student_name','u.profile_image','qa.score','qa.total_items','qa.created_at','c.id as course_id','c.name as course_name')
                    ->where(function($w) use ($user) {
                        $w->whereIn('q.course_id', function($sub) use ($user) {
                            $sub->from('courses')->select('id')->where('teacher_id', $user->id);
                        })
                        ->orWhere('q.creator_id', '=', $user->id);
                    })
                    ->where('qa.is_submitted', true)
                    ->orderByDesc('qa.created_at')
                    ->limit(200);
                if ($quizId) { $q->where('qa.quiz_id', intval($quizId)); }
                return $q->get();
            }
            // If a student is the creator of the quiz in question, allow them to view all attempts for that quiz
            if ($quizId) {
                $isCreator = DB::table('quizzes')->where('id', intval($quizId))->where('creator_id', $user->id)->exists();
                if ($isCreator) {
                    $q = DB::table('quiz_attempts as qa')
                        ->join('quizzes as q', 'qa.quiz_id', '=', 'q.id')
                        ->join('users as u', 'qa.student_id', '=', 'u.id')
                        ->leftJoin('courses as c', 'q.course_id', '=', 'c.id')
                        ->select('qa.id as attempt_id','q.id as quiz_id','q.title','u.id as student_id','u.name as student_name','u.profile_image','qa.score','qa.total_items','qa.created_at','c.id as course_id','c.name as course_name')
                        ->where('qa.quiz_id', intval($quizId))
                        ->where('qa.is_submitted', true)
                        ->orderByDesc('qa.created_at')
                        ->limit(200);
                    return $q->get();
                }
            }

            // Default: a student's own attempts
            $q = DB::table('quiz_attempts as qa')
                ->join('quizzes as q', 'qa.quiz_id', '=', 'q.id')
                ->leftJoin('courses as c', 'q.course_id', '=', 'c.id')
                ->select('qa.id as attempt_id','q.id as quiz_id','q.title','qa.score','qa.total_items','qa.created_at','c.id as course_id','c.name as course_name')
                ->where('qa.student_id', $user->id)
                ->where('qa.is_submitted', true)
                ->orderByDesc('qa.created_at')
                ->limit(200);
            if ($quizId) { $q->where('qa.quiz_id', intval($quizId)); }
            return $q->get();
        });
        return response()->json($rows);
    }
}
