<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use App\Models\Course;
use App\Models\User;
use App\Models\Enrollment;
use Illuminate\Support\Facades\Log;
use App\Helpers\StorageHelper;

class CourseController extends Controller
{
    // TEACHER: List my created courses
    public function myCreated(Request $request)
    {
        $user = $request->user();
        if (!$user || ($user->role ?? null) !== 'teacher') {
            return response()->json([], 200);
        }
        $courses = Course::where('teacher_id', $user->id)
            ->orderByDesc('created_at')
            ->get();
        foreach ($courses as $c) {
            $fixed = $this->fixedImageUrl($c->id);
            if ($fixed) {
                $c->image_url = $fixed;
            }
            // attach teacher info
            try { $u = $c->teacher_id ? User::find($c->teacher_id) : null; $c->teacher = $u ? ['id'=>$u->id,'username'=>$u->username ?? ($u->name ?? null),'email'=>$u->email] : null; } catch (\Throwable $__) { $c->teacher = null; }
            // counts
            try { $c->students_count = Enrollment::where('course_id', $c->id)->count(); } catch (\Throwable $__) {}
            try { if (Schema::hasTable('quizzes')) { $c->quizzes_count = \DB::table('quizzes')->where('course_id',$c->id)->count(); } } catch (\Throwable $__) {}
        }
        return response()->json($courses)->header('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    }

    // PUBLIC/Student: Discover public courses (optionally filter by query), excluding courses the viewer already enrolled in
    public function discover(Request $request)
    {
        $user = $request->user();
        $q = trim((string)$request->query('q', ''));
        $page = max(1, (int)$request->query('page', 0));
        $perPage = min(50, max(1, (int)$request->query('per_page', 20)));

        $query = Course::query()->where('is_public', true);
        if ($user) {
            try {
                $enrolledIds = Enrollment::where('user_id', $user->id)->pluck('course_id');
                if ($enrolledIds && $enrolledIds->count() > 0) {
                    $query->whereNotIn('id', $enrolledIds->all());
                }
            } catch (\Throwable $__) {}
        }
        if ($q !== '') {
            $query->where(function($w) use ($q) {
                $w->where('name', 'like', "%{$q}%")
                  ->orWhere('description', 'like', "%{$q}%");
                try { if (\Schema::hasColumn('courses','course_name')) { $w->orWhere('course_name','like', "%{$q}%"); } } catch (\Throwable $__) {}
                try { if (\Schema::hasColumn('courses','course_description')) { $w->orWhere('course_description','like', "%{$q}%"); } } catch (\Throwable $__) {}
            });
        }
        $cacheKey = 'courses:public:' . md5(json_encode([
            'u' => $user ? ($user->id ?? 0) : 0,
            'q' => $q,
            'p' => $page,
            'pp' => $perPage,
        ]));

        $result = Cache::remember($cacheKey, 60, function () use ($query, $page, $perPage) {
            if ($page > 0) {
                return $query->orderByDesc('created_at')->paginate($perPage);
            }
            return $query->orderByDesc('created_at')->limit(100)->get();
        });

        // Normalize image URLs and attach counts/teacher for returned rows
        $decorate = function ($c) {
            $fixed = $this->fixedImageUrl($c->id);
            if ($fixed) {
                $c->image_url = $fixed;
            }
            try { $u = $c->teacher_id ? User::find($c->teacher_id) : null; $c->teacher = $u ? ['id'=>$u->id,'username'=>$u->username ?? ($u->name ?? null),'email'=>$u->email] : null; } catch (\Throwable $__) { $c->teacher = null; }
            try { $c->students_count = Enrollment::where('course_id', $c->id)->count(); } catch (\Throwable $__) {}
            try { if (Schema::hasTable('quizzes')) { $c->quizzes_count = \DB::table('quizzes')->where('course_id',$c->id)->count(); } } catch (\Throwable $__) {}
            return $c;
        };

        if ($page > 0 && method_exists($result, 'items')) {
            $items = array_map(fn($c) => $decorate($c), $result->items());
            return response()->json([
                'data' => $items,
                'meta' => [
                    'current_page' => $result->currentPage(),
                    'per_page' => $result->perPage(),
                    'total' => $result->total(),
                    'last_page' => $result->lastPage(),
                ],
            ])->header('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
        }

        $courses = is_array($result) ? $result : ($result instanceof \Illuminate\Support\Collection ? $result->all() : []);
        $courses = array_map(fn($c) => $decorate($c), $courses);
        return response()->json($courses)->header('Cache-Control', 'private, max-age=30');
    }
    public function store(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->role !== 'teacher') {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'name' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'is_public' => 'nullable',
            'course_code' => 'nullable|string|max:64',
            'image' => 'nullable|file|mimes:jpg,jpeg,png,webp|max:4096',
        ]);

        $course = new Course();
        // name / course_name
        if (Schema::hasColumn('courses','name')) {
            $course->name = $request->name;
        } elseif (Schema::hasColumn('courses','course_name')) {
            $course->course_name = $request->name;
        }
        // description / course_description
        $descVal = $request->description ?? '';
        if (Schema::hasColumn('courses','description')) {
            $course->description = $descVal;
        } elseif (Schema::hasColumn('courses','course_description')) {
            $course->course_description = $descVal;
        }
        // Normalize boolean (use this local flag for logic regardless of schema)
        $isPublic = $request->has('is_public')
            ? (filter_var((string)$request->input('is_public'), FILTER_VALIDATE_BOOLEAN) || in_array((string)$request->input('is_public'), ['1','on','yes'], true))
            : true;
        if (Schema::hasColumn('courses','is_public')) {
            $course->is_public = (bool)$isPublic;
        }
        // Course code (optional when public)
        $code = $request->input('course_code');
        if (!$isPublic && empty($code)) {
            $code = strtoupper(Str::random(6));
        }
        if (!empty($code) && Schema::hasColumn('courses','course_code')) { $course->course_code = $code; }
        // Fallback: some schemas may require course_code NOT NULL. If column exists and still empty, set a random code.
        if (Schema::hasColumn('courses','course_code') && empty($course->course_code)) {
            $course->course_code = strtoupper(Str::random(6));
        }

        if (Schema::hasColumn('courses','teacher_id')) { $course->teacher_id = $user->id ?? null; }
        if (Schema::hasColumn('courses','teacher_email')) { $course->teacher_email = $user->email ?? ''; }
        $course->save();

        // diagnostics for multipart reception
        try {
            \Log::info('COURSE_CREATE_DIAG', [
                'hasFile_image' => $request->hasFile('image'),
                'files_keys' => array_keys($request->allFiles()),
                'content_type' => $request->header('Content-Type'),
            ]);
        } catch (\Throwable $__) {}

        $uploadedS3Key = null;
        if ($request->hasFile('image')) {
            try {
                $url = StorageHelper::overwriteFixedCourseImage($request->file('image'), $course->id);
                $course->image_url = $url;
                $course->save();
                $uploadedS3Key = StorageHelper::urlToS3Key($url);
                Log::info('COURSE_IMAGE_UPLOAD_S3_OK', ['url' => $url]);
                try { Cache::forget('course:image:url:' . (int)$course->id); } catch (\Throwable $__) {}
            } catch (\Throwable $e) {
                Log::error('COURSE_IMAGE_UPLOAD_S3_FAILED', ['error' => $e->getMessage()]);
                // Non-fatal: keep course without image (placeholder will render)
            }
        }

        // Return fresh with cache-busted image (prefer fixed key)
        $fresh = Course::find($course->id);
        if ($fresh) {
            $fixed = $this->fixedImageUrl($fresh->id);
            if ($fixed) {
                $fresh->image_url = $fixed;
            } elseif (!empty($fresh->image_url) && strpos($fresh->image_url,'?v=') === false) {
                $fresh->image_url = $fresh->image_url.'?v='.time();
            }
        }
        $resp = ['message' => 'Course created successfully', 'course' => $fresh ?: $course];
        // include diagnostics to verify file reception/path (safe: no secrets)
        $resp['_debug'] = [
            'hasFile_image' => $request->hasFile('image'),
            'files_keys' => array_keys($request->allFiles()),
        ];
        if ($uploadedS3Key) { $resp['_debug']['s3_key'] = $uploadedS3Key; }
        return response()->json($resp, 201);
    }

    public function update(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->role !== 'teacher') {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'image' => 'nullable|file|mimes:jpg,jpeg,png|max:2048',
        ]);

        $course = Course::findOrFail($id);
        if ((int)($course->teacher_id) !== (int)($user->id)) {
            return response()->json(['error' => 'Forbidden: only the creator can edit this course'], 403);
        }
        if ($request->filled('name')) { $course->name = $request->name; }
        if ($request->exists('description')) { $course->description = $request->description ?? $course->description; }
        if ($request->exists('is_public')) {
            $ip = $request->input('is_public');
            $bool = filter_var((string)$ip, FILTER_VALIDATE_BOOLEAN) || in_array((string)$ip, ['1','on','yes'], true);
            $course->is_public = (bool)$bool;
        }
        if ($request->exists('course_code')) {
            $course->course_code = $request->input('course_code') ?: $course->course_code;
        }
        if ($course->is_public && empty($request->input('course_code'))) {
            // keep existing code or null; no action needed
        } elseif (!$course->is_public && empty($course->course_code)) {
            $course->course_code = strtoupper(Str::random(6));
        }
        // Mirror to legacy columns if present
        try {
            if (Schema::hasColumn('courses','course_name')) {
                $course->course_name = $course->name;
            }
            if (Schema::hasColumn('courses','course_description')) {
                $course->course_description = $course->description;
            }
        } catch (\Throwable $e) {}

        $uploadedS3Key = null;
        if ($request->hasFile('image')) {
            try {
                $url = StorageHelper::overwriteFixedCourseImage($request->file('image'), $course->id);
                Log::debug('COURSE_UPDATE_IMAGE_OK');
                $course->image_url = $url;
                $uploadedS3Key = StorageHelper::urlToS3Key($url);
                try { Cache::forget('course:image:url:' . (int)$course->id); } catch (\Throwable $__) {}
            } catch (\Throwable $e) {
                Log::error('COURSE_UPDATE_IMAGE_FAILED', ['error'=>$e->getMessage()]);
                return response()->json(['error' => 'Failed to upload course image. Please try again.'], 500);
            }
        }

        $course->save();
        $fresh = Course::find($course->id);
        if ($fresh) {
            $fixed = $this->fixedImageUrl($fresh->id);
            if ($fixed) {
                $fresh->image_url = $fixed;
            } elseif (!empty($fresh->image_url) && strpos($fresh->image_url,'?v=') === false) {
                if (str_starts_with($fresh->image_url, '/')) { $fresh->image_url = url($fresh->image_url); }
                $fresh->image_url = $fresh->image_url.'?v='.time();
            }
        }
        $resp = ['message' => 'Course updated successfully', 'course' => $fresh ?: $course];
        if ($uploadedS3Key) { $resp['_debug'] = ['s3_key' => $uploadedS3Key]; }
        return response()->json($resp)->header('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
        return response()->json($resp);
    }

    public function destroy($id)
    {
        $user = request()->user();
        if (!$user || ($user->role ?? null) !== 'teacher') {
            return response()->json(['error' => 'Unauthorized'], 403);
        }
        $course = Course::findOrFail($id);
        if ((int)($course->teacher_id) !== (int)($user->id)) {
            return response()->json(['error' => 'Forbidden: only the creator can delete this course'], 403);
        }
        $courseId = $course->id;

        try {
            $files = Storage::disk('s3')->allFiles("course_images/{$courseId}");
            if (!empty($files)) {
                Storage::disk('s3')->delete($files);
            }
        } catch (\Exception $e) {
            Log::error('COURSE_DELETE_S3_FAILED', ['error' => $e->getMessage()]);
        }

        Storage::deleteDirectory("public/course_images/{$courseId}");
        $course->delete();

        return response()->json(['message' => 'Course deleted successfully']);
    }

    public function index()
    {
        $courses = Course::orderByDesc('created_at')->get();
        foreach ($courses as $c) {
            $fixed = $this->fixedImageUrl($c->id);
            if ($fixed) {
                $c->image_url = $fixed;
            } elseif (!empty($c->image_url) && strpos($c->image_url, '?v=') === false) {
                $c->image_url = $c->image_url . '?v=' . time();
            }
            try { $c->students_count = Enrollment::where('course_id', $c->id)->count(); } catch (\Throwable $__) {}
            try { if (Schema::hasTable('quizzes')) { $c->quizzes_count = \DB::table('quizzes')->where('course_id',$c->id)->count(); } } catch (\Throwable $__) {}
        }
        return response()->json($courses)->header('Cache-Control', 'private, max-age=30');
    }

    // STUDENT: my enrolled courses
    public function myCourses(Request $request)
    {
        $user = $request->user();
        if (!$user) return response()->json([], 200);
        $ids = Enrollment::where('user_id', $user->id)->pluck('course_id');
        $courses = Course::whereIn('id', $ids)->orderByDesc('created_at')->get();
        foreach ($courses as $c) {
            $fixed = $this->fixedImageUrl($c->id);
            if ($fixed) { $c->image_url = $fixed; }
            try { $u = $c->teacher_id ? User::find($c->teacher_id) : null; $c->teacher = $u ? ['id'=>$u->id,'username'=>$u->username ?? ($u->name ?? null),'email'=>$u->email] : null; } catch (\Throwable $__) { $c->teacher = null; }
            try { $c->students_count = Enrollment::where('course_id', $c->id)->count(); } catch (\Throwable $__) {}
            try { if (Schema::hasTable('quizzes')) { $c->quizzes_count = \DB::table('quizzes')->where('course_id',$c->id)->count(); } } catch (\Throwable $__) {}
        }
        return response()->json($courses)->header('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    }

    public function show($id)
    {
        $viewer = request()->user();
        $cacheKey = 'course:show:' . md5(json_encode([
            'id' => (int)$id,
            'viewer' => $viewer ? ($viewer->id ?? 0) : 0,
        ]));

        $course = Cache::remember($cacheKey, 60, function () use ($id, $viewer) {
            $course = Course::findOrFail($id);
            $fixed = $this->fixedImageUrl($course->id);
            if ($fixed) {
                $course->image_url = $fixed;
            } else if (!empty($course->image_url) && strpos($course->image_url, '?v=') === false) {
                $course->image_url = $course->image_url . '?v=' . time();
            }
            // attach teacher info
            try { $u = $course->teacher_id ? User::find($course->teacher_id) : null; $course->teacher = $u ? ['id'=>$u->id,'username'=>$u->username ?? ($u->name ?? null),'email'=>$u->email] : null; } catch (\Throwable $__) { $course->teacher = null; }
            // attach viewer enrollment flag
            try { $course->enrolled = ($viewer && Enrollment::where('user_id', $viewer->id)->where('course_id', $course->id)->exists()); } catch (\Throwable $__) { $course->enrolled = false; }
            // attach counts
            try { $course->students_count = Enrollment::where('course_id', $course->id)->count(); } catch (\Throwable $__) { $course->students_count = 0; }
            try { if (Schema::hasTable('quizzes')) { $course->quizzes_count = \DB::table('quizzes')->where('course_id',$course->id)->count(); } } catch (\Throwable $__) { $course->quizzes_count = $course->quizzes_count ?? 0; }
            return $course;
        });

        // Restrict private course read for non-owner, non-enrolled
        try {
            $viewerNow = request()->user();
            $isOwner = $viewerNow && ((int)$viewerNow->id === (int)$course->teacher_id);
            if (!$course->is_public && !$isOwner && !$course->enrolled) {
                return response()->json(['message' => 'This course is private. Join it first.'], 403);
            }
        } catch (\Throwable $__) {}

        // Always fetch announcements fresh (not cached)
        try {
            $viewerNow = request()->user();
            $isOwnerNow = $viewerNow && ((int)$viewerNow->id === (int)$course->teacher_id);
            if ($isOwnerNow || ($course->enrolled ?? false)) {
                $anns = \App\Models\Announcement::where('course_id', $course->id)
                    ->orderByDesc('created_at')
                    ->limit(50)
                    ->get(['id','course_id','title','message','created_at','updated_at']);
                $course->announcements = $anns;
            }
        } catch (\Throwable $__) {}

        return response()->json($course)->header('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    }

    // TEACHER: View and manage students (list only)
    public function listStudents(Request $request, $id)
    {
        $user = $request->user();
        $course = Course::findOrFail($id);
        if (!$user || $course->teacher_id !== ($user->id ?? null)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }
        try {
            $students = \DB::table('enrollments')
                ->join('users','users.id','=','enrollments.user_id')
                ->where('enrollments.course_id', $course->id)
                ->select('users.id','users.username','users.name','users.role','users.profile_image')
                ->orderBy('users.username')
                ->get();
        } catch (\Throwable $__) { $students = collect([]); }
        return response()->json($students);
    }

    // STUDENT: Join a public course by numeric ID
    public function join(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) return response()->json(['error' => 'Unauthorized'], 401);
        $course = Course::findOrFail($id);
        if (!$course->is_public) {
            return response()->json(['error' => 'Course is private. Use code to join.'], 403);
        }
        $enr = Enrollment::firstOrCreate(['user_id' => $user->id, 'course_id' => $course->id]);
        return response()->json(['message' => 'Joined', 'course_id' => $course->id, 'enrolled_at' => $enr->created_at]);
    }

    // STUDENT: Leave a course by ID
    public function leave(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) return response()->json(['error' => 'Unauthorized'], 401);
        $course = Course::findOrFail($id);
        Enrollment::where('user_id', $user->id)->where('course_id', $course->id)->delete();
        return response()->json(['left' => true, 'course_id' => $course->id]);
    }

    // STUDENT: Classmates list (enrolled only)
    public function classmates(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) return response()->json(['error' => 'Unauthorized'], 401);
        $course = Course::findOrFail($id);
        $enrolled = Enrollment::where('user_id', $user->id)->where('course_id', $course->id)->exists();
        if (!$enrolled && (int)$course->teacher_id !== (int)$user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }
        $rows = \DB::table('enrollments')
            ->join('users','users.id','=','enrollments.user_id')
            ->where('enrollments.course_id',$course->id)
            ->select('users.id','users.username','users.profile_image','users.role')
            ->get();
        return response()->json($rows);
    }

    // TEACHER: Remove a student from course and cascade their quiz attempts/responses for this course
    public function removeStudent(Request $request, $id, $user_id)
    {
        $user = $request->user();
        $course = Course::findOrFail($id);
        if (!$user || (int)$course->teacher_id !== (int)$user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }
        // Remove enrollment
        Enrollment::where('user_id', (int)$user_id)->where('course_id', $course->id)->delete();
        // Delete attempts and responses tied to this course's quizzes for that student
        try {
            $quizIds = \DB::table('quizzes')->where('course_id', $course->id)->pluck('id');
            if ($quizIds && $quizIds->count() > 0) {
                $attemptIds = \DB::table('quiz_attempts')
                    ->whereIn('quiz_id', $quizIds)
                    ->where('student_id', (int)$user_id)
                    ->pluck('id');
                if ($attemptIds && $attemptIds->count() > 0) {
                    \DB::table('quiz_responses')->whereIn('attempt_id', $attemptIds)->delete();
                    \DB::table('quiz_attempts')->whereIn('id', $attemptIds)->delete();
                }
            }
        } catch (\Throwable $__) {}
        return response()->json(['removed' => true]);
    }

    // STUDENT: Join a course by code (for private courses)
    public function joinByCode(Request $request, $code)
    {
        $user = $request->user();
        if (!$user) return response()->json(['error' => 'Unauthorized'], 401);
        $course = Course::where('course_code', $code)->first();
        if (!$course) return response()->json(['error' => 'Course not found'], 404);
        $enr = Enrollment::firstOrCreate(['user_id' => $user->id, 'course_id' => $course->id]);
        return response()->json(['message' => 'Joined', 'course_id' => $course->id, 'enrolled_at' => $enr->created_at]);
    }

    // Resolve fixed image URL if present: course_images/{id}/image.(jpg|jpeg|png|webp)
    private function fixedImageUrl($courseId): ?string
    {
        $cacheKey = 'course:image:url:' . (int)$courseId;
        return Cache::remember($cacheKey, now()->addHours(6), function () use ($courseId) {
            $candidates = [
                "course_images/{$courseId}/image", // fixed key without extension
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
