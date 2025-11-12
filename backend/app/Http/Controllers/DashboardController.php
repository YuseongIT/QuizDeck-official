<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Quiz;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $lite = filter_var((string)$request->query('lite', ''), FILTER_VALIDATE_BOOLEAN);

        $cacheKey = 'dashboard:v3:user:' . $user->id . ':role:' . $user->role . ':lite:' . ($lite ? '1' : '0');
        $payload = Cache::remember($cacheKey, now()->addSeconds(120), function () use ($user, $lite) {
            if ($user->role === 'student') {
                $enrolledCourseIds = Enrollment::where('user_id', $user->id)->pluck('course_id');
                $courses = Course::whereIn('id', $enrolledCourseIds)
                    ->with('teacher:id,username,email')
                    ->get(['id','name','course_code','teacher_id','teacher_email','created_at','image_url','is_public']);
                $courseIds = $courses->pluck('id')->all();
                // batch counts
                $studentCounts = Enrollment::whereIn('course_id', $courseIds)
                    ->select('course_id', DB::raw('count(*) as cnt'))
                    ->groupBy('course_id')->pluck('cnt','course_id');
                $quizCounts = \Schema::hasTable('quizzes')
                    ? DB::table('quizzes')->whereIn('course_id',$courseIds)->select('course_id', DB::raw('count(*) as cnt'))->groupBy('course_id')->pluck('cnt','course_id')
                    : collect();
                foreach ($courses as $c) {
                    // ensure image_url is resolvable
                    if (empty($c->image_url)) {
                        $fixed = $this->fixedImageUrl($c->id);
                        if ($fixed) { $c->image_url = $fixed; }
                    }
                    $c->students_count = (int)($studentCounts[$c->id] ?? 0);
                    $c->quizzes_count = (int)($quizCounts[$c->id] ?? 0);
                }

                $quizzes = Quiz::whereIn('course_id', $enrolledCourseIds)
                    ->where('is_published', true)
                    ->where('is_available', true)
                    ->with(['course:id,name,course_code', 'creator:id,username'])
                    ->withCount('items')
                    ->orderByDesc('created_at')
                    ->limit(12)
                    ->get(['id','title','description','course_id','creator_id','is_published','is_available','is_shared','is_repeatable','created_at','preview_image_url']);

                $announcements = [];
                $activity = [];
                if (!$lite) {
                    if (\Schema::hasTable('announcement_dismissals')) {
                        $announcements = Announcement::whereIn('course_id', $enrolledCourseIds)
                            ->leftJoin('announcement_dismissals as ad', function($j) use ($user) {
                                $j->on('ad.announcement_id', '=', 'announcements.id')
                                  ->where('ad.user_id', '=', $user->id);
                            })
                            ->whereNull('ad.id')
                            ->select('announcements.*')
                            ->with(['course:id,name,course_code', 'teacher:id,username'])
                            ->orderByDesc('created_at')
                            ->limit(12)
                            ->get(['id','course_id','teacher_id','title','message','created_at']);
                    } else {
                        $announcements = Announcement::whereIn('course_id', $enrolledCourseIds)
                            ->with(['course:id,name,course_code', 'teacher:id,username'])
                            ->orderByDesc('created_at')
                            ->limit(12)
                            ->get();
                    }

                    $activity = ActivityLog::where('user_id', $user->id)
                        ->with(['quiz:id,title,course_id', 'quiz.course:id,name,course_code'])
                        ->orderByDesc('completed_at')
                        ->limit(10)
                        ->get(['id','user_id','quiz_id','completed_at']);
                }

                return [
                    'user' => [ 'username' => $user->username, 'role' => $user->role ],
                    'courses' => $courses,
                    'quizzes' => $quizzes,
                    'announcements' => $announcements,
                    'activity' => $activity,
                ];
            }

            // Teacher dashboard
            $courses = Course::where('teacher_id', $user->id)
                ->with('teacher:id,username,email')
                ->get(['id','name','course_code','teacher_id','teacher_email','created_at','image_url','is_public']);
            $courseIds = $courses->pluck('id')->all();
            $studentCounts = Enrollment::whereIn('course_id', $courseIds)
                ->select('course_id', DB::raw('count(*) as cnt'))
                ->groupBy('course_id')->pluck('cnt','course_id');
            $quizCounts = \Schema::hasTable('quizzes')
                ? DB::table('quizzes')->whereIn('course_id',$courseIds)->select('course_id', DB::raw('count(*) as cnt'))->groupBy('course_id')->pluck('cnt','course_id')
                : collect();
            foreach ($courses as $c) {
                if (empty($c->image_url)) {
                    $fixed = $this->fixedImageUrl($c->id);
                    if ($fixed) { $c->image_url = $fixed; }
                }
                $c->students_count = (int)($studentCounts[$c->id] ?? 0);
                $c->quizzes_count = (int)($quizCounts[$c->id] ?? 0);
            }
            $courseIds = $courses->pluck('id');

            $quizzes = Quiz::whereIn('course_id', $courseIds)
                ->orWhere('creator_id', $user->id)
                ->with(['course:id,name,course_code','creator:id,username'])
                ->withCount('items')
                ->orderByDesc('created_at')
                ->limit(12)
                ->get(['id','title','description','course_id','creator_id','is_published','is_available','is_shared','is_repeatable','created_at','preview_image_url']);

            $announcements = [];
            $activity = [];
            if (!$lite) {
                $announcements = Announcement::where('teacher_id', $user->id)
                    ->with(['course:id,name,course_code'])
                    ->orderByDesc('created_at')
                    ->limit(12)
                    ->get(['id','course_id','teacher_id','title','message','created_at']);

                $activity = ActivityLog::whereHas('quiz', function ($q) use ($courseIds) {
                        $q->whereIn('course_id', $courseIds);
                    })
                    ->with(['user:id,username', 'quiz:id,title,course_id', 'quiz.course:id,name,course_code'])
                    ->orderByDesc('completed_at')
                    ->limit(15)
                    ->get(['id','user_id','quiz_id','completed_at']);
            }

            return [
                'user' => [ 'username' => $user->username, 'role' => $user->role ],
                'courses' => $courses,
                'quizzes' => $quizzes,
                'announcements' => $announcements,
                'activity' => $activity,
            ];
        });

        return response()->json($payload)->header('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    }

    // Resolve fixed image URL if present: course_images/{id}/image.(jpg|jpeg|png|webp)
    private function fixedImageUrl($courseId): ?string
    {
        $cacheKey = 'course:image:url:' . (int)$courseId;
        return \Illuminate\Support\Facades\Cache::remember($cacheKey, now()->addHours(6), function () use ($courseId) {
            $candidates = [
                "course_images/{$courseId}/image",
                "course_images/{$courseId}/image.jpg",
                "course_images/{$courseId}/image.jpeg",
                "course_images/{$courseId}/image.png",
                "course_images/{$courseId}/image.webp",
            ];
            foreach ($candidates as $key) {
                try {
                    if (Storage::disk('s3')->exists($key)) {
                        $url = Storage::disk('s3')->url($key);
                        if (str_starts_with($url, '/')) { $url = url($url); }
                        try {
                            $ver = Storage::disk('s3')->lastModified($key);
                            if ($ver) {
                                $sep = str_contains($url, '?') ? '&' : '?';
                                return $url . $sep . 'v=' . $ver;
                            }
                        } catch (\Throwable $__) { /* ignore */ }
                        return $url;
                    }
                } catch (\Throwable $__) {}
            }
            return null;
        });
    }
}
