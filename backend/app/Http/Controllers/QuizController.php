<?php

namespace App\Http\Controllers;

use App\Models\Enrollment;
use App\Models\Quiz;
use App\Models\Course;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Cache;
use App\Helpers\StorageHelper;

class QuizController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $cacheKey = 'quizzes:index:v1:user:' . ($user->id ?? 0) . ':role:' . ($user->role ?? '');
        $quizzes = Cache::remember($cacheKey, now()->addSeconds(60), function () use ($user) {
            if ($user->role === 'teacher') {
                $courseIds = Course::where('teacher_id', $user->id)->pluck('id');
                return Quiz::whereIn('course_id', $courseIds)
                    ->orWhere('creator_id', $user->id)
                    ->with(['course:id,name,course_code', 'creator:id,username'])
                    ->withCount('items')
                    ->orderByDesc('created_at')
                    ->get(['id','title','description','course_id','creator_id','is_published','is_available','is_shared','is_repeatable','created_at','preview_image_url']);
            }
            $enrolledCourseIds = Enrollment::where('user_id', $user->id)->pluck('course_id');
            $friendIds = \DB::table('friends')
                ->where(function($q) use ($user) { $q->where('user_id', $user->id)->orWhere('friend_id', $user->id); })
                ->where('status', 'accepted')
                ->selectRaw('CASE WHEN user_id = ? THEN friend_id ELSE user_id END AS fid', [$user->id])
                ->pluck('fid');
            return Quiz::query()
                ->where(function ($q) use ($enrolledCourseIds) {
                    $q->whereIn('course_id', $enrolledCourseIds)
                      ->where('is_published', true)
                      ->where('is_available', true);
                })
                ->orWhere(function ($q) use ($user) {
                    $q->where('creator_id', $user->id);
                })
                ->orWhere(function ($q) use ($friendIds) {
                    if (count($friendIds) > 0) {
                        $q->whereIn('creator_id', $friendIds)
                          ->where('is_shared', true)
                          ->where('is_published', true)
                          ->where('is_available', true);
                    }
                })
                ->with(['course:id,name,course_code', 'creator:id,username'])
                ->withCount('items')
                ->orderByDesc('created_at')
                ->get(['id','title','description','course_id','creator_id','is_published','is_available','is_shared','is_repeatable','created_at','preview_image_url']);
        });
        // Normalize preview_image_url with deterministic cache-busting
        try {
            foreach ($quizzes as $q) {
                if (!empty($q->preview_image_url)) {
                    try {
                        $key = StorageHelper::urlToS3Key($q->preview_image_url);
                        if (!$key) {
                            // Try common fixed keys
                            $candidates = [
                                "preview_images/{$q->id}/image",
                                "preview_images/{$q->id}/image.jpg",
                                "preview_images/{$q->id}/image.jpeg",
                                "preview_images/{$q->id}/image.png",
                                "preview_images/{$q->id}/image.webp",
                            ];
                            foreach ($candidates as $cand) { if (Storage::disk('s3')->exists($cand)) { $key = $cand; break; } }
                        }
                        if ($key) {
                            $ver = Storage::disk('s3')->lastModified($key);
                            if ($ver) {
                                $base = $q->preview_image_url;
                                $sep = str_contains($base, '?') ? '&' : '?';
                                $q->preview_image_url = $base . $sep . 'v=' . $ver;
                            }
                        }
                    } catch (\Throwable $__) { /* ignore per row */ }
                }
            }
        } catch (\Throwable $__) { /* ignore */ }
        return response()->json($quizzes)->header('Cache-Control', 'private, max-age=30');
    }

    public function uploadPreview(Request $request, $id)
    {
        $quiz = Quiz::findOrFail($id);
        $user = $request->user();
        if ($user->role !== 'teacher' && $quiz->creator_id !== $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $request->validate(['image' => ['required','file','image','max:5120']]); // 5MB
        $file = $request->file('image');
        $ext = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        $dir = "preview_images/{$quiz->id}";
        $name = "image.$ext";
        // Prefer configured default disk, with automatic fallback to 'public'
        $disk = config('filesystems.default', 'public');
        $url = null; $storedKey = null; $usedDisk = $disk;
        // Attempt 1: default disk
        try {
            $path = $file->storePubliclyAs($dir, $name, ['disk' => $disk]);
            $storedKey = $path;
            $url = Storage::disk($disk)->url($path);
        } catch (\Throwable $e) {
            // Attempt 2: raw put on default disk
            try {
                $key = rtrim($dir, '/') . '/' . $name;
                Storage::disk($disk)->put($key, fopen($file->getRealPath(), 'r'));
                $storedKey = $key;
                $url = Storage::disk($disk)->url($key);
            } catch (\Throwable $e2) {
                // Attempt 3: fallback to 'public' disk
                try {
                    $fallback = 'public';
                    $path = $file->storePubliclyAs($dir, $name, ['disk' => $fallback]);
                    $storedKey = $path; $usedDisk = $fallback;
                    $url = Storage::disk($fallback)->url($path);
                } catch (\Throwable $e3) {
                    // Final failure: report diagnostic
                    return response()->json([
                        'message' => 'Failed to upload preview image',
                        'hint' => 'If using S3, verify AWS credentials, bucket, region, and s3:PutObject permissions. Otherwise ensure storage:link exists and storage is writable.',
                        'error' => $e3->getMessage(),
                    ], 500);
                }
            }
        }
        // Deterministic cache-busting based on object last modified time
        try {
            $key = $storedKey ?: (rtrim($dir, '/') . '/' . $name);
            $ver = Storage::disk($usedDisk)->lastModified($key);
            if ($ver) {
                $sep = str_contains($url, '?') ? '&' : '?';
                $url = $url . $sep . 'v=' . $ver;
            }
        } catch (\Throwable $__) { /* ignore */ }

        $quiz->preview_image_url = $url;
        $quiz->save();
        // Invalidate cached quiz lists for this user (teacher view) and generic student list
        try {
            Cache::forget('quizzes:index:v1:user:' . ($user->id ?? 0) . ':role:' . ($user->role ?? ''));
        } catch (\Throwable $__) {}
        return response()->json(['preview_image_url' => $url])->header('Cache-Control', 'private, max-age=30');
    }

    public function autosave(Request $request, $id)
    {
        $quiz = Quiz::findOrFail($id);
        $user = $request->user();
        if ($user->role !== 'teacher' && $quiz->creator_id !== $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        if ($quiz->is_published || $quiz->status === 'published') {
            return response()->json(['message' => 'Quiz is published and cannot be edited'], 409);
        }
        $data = $request->validate([
            'title' => ['sometimes','string','max:255'],
            'description' => ['nullable','string'],
            'is_repeatable' => ['sometimes','boolean'],
            'is_shared' => ['sometimes','boolean'],
            'is_available' => ['sometimes','boolean'],
        ]);
        $quiz->fill($data)->save();
        return response()->json(['saved' => true, 'quiz' => $quiz]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'title' => ['required','string','max:255'],
            'description' => ['nullable','string'],
            'course_id' => ['nullable','integer', Rule::exists('courses','id')],
            'visibility' => ['required', Rule::in(['public','friends'])],
            'is_repeatable' => ['sometimes','boolean'],
            'is_shared' => ['sometimes','boolean'],
            'is_available' => ['sometimes','boolean'],
        ]);

        if ($user->role === 'teacher' && isset($data['course_id'])) {
            $ownsCourse = Course::where('id', $data['course_id'])->where('teacher_id', $user->id)->exists();
            if (!$ownsCourse) return response()->json(['message' => 'You do not own this course'], 403);
        } elseif ($user->role !== 'teacher' && isset($data['course_id'])) {
            $enrolled = Enrollment::where('user_id', $user->id)->where('course_id', $data['course_id'])->exists();
            if (!$enrolled) return response()->json(['message' => 'You are not enrolled in this course'], 403);
        }

        $quiz = Quiz::create([
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'course_id' => $data['course_id'] ?? null,
            'creator_id' => $user->id,
            'creator_role' => $user->role,
            'visibility' => $data['visibility'],
            'is_repeatable' => $data['is_repeatable'] ?? true,
            'is_shared' => $data['is_shared'] ?? false,
            'is_available' => $data['is_available'] ?? true,
            'is_published' => false,
            'status' => 'draft',
        ]);

        return response()->json($quiz, 201);
    }

    public function show(Request $request, $id)
    {
        $user = $request->user();
        $quiz = Quiz::with(['items.choices','creator:id,username','course:id,name,course_code'])->findOrFail($id);
        if ($quiz->creator_id !== $user->id) {
            $allowed = false;
            if ($quiz->course_id) {
                // course-bound: must be published+available and enrolled
                $enrolled = Enrollment::where('user_id', $user->id)->where('course_id', $quiz->course_id)->exists();
                $allowed = $quiz->is_published && $quiz->is_available && $enrolled;
            } else {
                // personal/shared: must be published+available and creator is friend and shared
                $friendIds = \DB::table('friends')
                    ->where(function($q) use ($user) { $q->where('user_id', $user->id)->orWhere('friend_id', $user->id); })
                    ->where('status', 'accepted')
                    ->selectRaw('CASE WHEN user_id = ? THEN friend_id ELSE user_id END AS fid', [$user->id])
                    ->pluck('fid');
                $allowed = $quiz->is_published && $quiz->is_available && $quiz->is_shared && $friendIds->contains($quiz->creator_id);
            }
            if (!$allowed) return response()->json(['message' => 'Forbidden'], 403);
        }
        // Ensure preview image has a version param
        try {
            if (!empty($quiz->preview_image_url)) {
                $key = StorageHelper::urlToS3Key($quiz->preview_image_url) ?: null;
                if (!$key) {
                    $cands = [
                        "preview_images/{$quiz->id}/image",
                        "preview_images/{$quiz->id}/image.jpg",
                        "preview_images/{$quiz->id}/image.jpeg",
                        "preview_images/{$quiz->id}/image.png",
                        "preview_images/{$quiz->id}/image.webp",
                    ];
                    foreach ($cands as $cand) { if (Storage::disk('s3')->exists($cand)) { $key = $cand; break; } }
                }
                if ($key) {
                    $ver = Storage::disk('s3')->lastModified($key);
                    if ($ver) { $sep = str_contains($quiz->preview_image_url, '?') ? '&' : '?'; $quiz->preview_image_url = $quiz->preview_image_url . $sep . 'v=' . $ver; }
                }
            }
        } catch (\Throwable $__) { /* ignore */ }
        return response()->json($quiz)->header('Cache-Control', 'private, max-age=30');
    }

    public function update(Request $request, $id)
    {
        $quiz = Quiz::findOrFail($id);
        $user = $request->user();
        if ($user->role !== 'teacher' && $quiz->creator_id !== $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        // Prevent editing locked fields if published
        $locked = $quiz->is_published || ($quiz->status === 'published');
        $data = $request->validate([
            'title' => ['sometimes','string','max:255'],
            'description' => ['nullable','string'],
            'course_id' => ['nullable','integer', Rule::exists('courses','id')],
            'visibility' => ['sometimes', Rule::in(['public','friends'])],
            'is_published' => ['sometimes','boolean'],
            'is_repeatable' => ['sometimes','boolean'],
            'is_shared' => ['sometimes','boolean'],
            'is_available' => ['sometimes','boolean'],
        ]);
        if ($locked) {
            unset($data['title'], $data['description'], $data['course_id']);
        }
        // status follows is_published
        if (array_key_exists('is_published', $data)) {
            $data['status'] = $data['is_published'] ? 'published' : 'draft';
        }
        $quiz->fill($data)->save();
        return response()->json($quiz);
    }

    public function destroy(Request $request, $id)
    {
        $quiz = Quiz::with('items')->findOrFail($id);
        $user = $request->user();
        if ($user->role !== 'teacher' && $quiz->creator_id !== $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        DB::transaction(function () use ($quiz) {
            // delete S3 images under quiz_images/{quiz_id}/
            try {
                $prefix = 'quiz_images/' . $quiz->id . '/';
                $files = Storage::disk('s3')->allFiles($prefix);
                if (!empty($files)) {
                    Storage::disk('s3')->delete($files);
                }
                // also delete preview_images/{quiz_id}/image.*
                $pprefix = 'preview_images/' . $quiz->id . '/';
                $pfiles = Storage::disk('s3')->allFiles($pprefix);
                if (!empty($pfiles)) {
                    Storage::disk('s3')->delete($pfiles);
                }
            } catch (\Throwable $e) {}
            $quiz->delete();
        });
        return response()->json(['deleted' => true]);
    }

    public function publish(Request $request, $id)
    {
        $quiz = Quiz::findOrFail($id);
        $user = $request->user();
        if ($user->role !== 'teacher' && $quiz->creator_id !== $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $quiz->is_published = true;
        $quiz->status = 'published';
        $quiz->save();
        return response()->json($quiz);
    }

    public function toggle(Request $request, $id)
    {
        $quiz = Quiz::findOrFail($id);
        $user = $request->user();
        if ($user->role !== 'teacher' && $quiz->creator_id !== $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $quiz->is_available = !$quiz->is_available;
        $quiz->save();
        return response()->json($quiz);
    }
    public function byCourse(Request $request, $course)
    {
        $user = $request->user();
        $courseId = intval($course);

        // Permission: teacher must own the course; student must be enrolled or the creator of a quiz in that course
        if ($user->role === 'teacher') {
            $owns = Course::where('id', $courseId)->where('teacher_id', $user->id)->exists();
            if (!$owns) return response()->json(['message' => 'Not allowed'], 403);
        } else {
            $enrolled = Enrollment::where('user_id', $user->id)->where('course_id', $courseId)->exists();
            if (!$enrolled) {
                // Allow personal quizzes the user created in that course
                $hasPersonal = Quiz::where('course_id', $courseId)->where('creator_id', $user->id)->exists();
                if (!$hasPersonal) return response()->json(['message' => 'Not allowed'], 403);
            }
        }

        $quizzes = Quiz::where('course_id', $courseId)
            ->with(['course:id,name,course_code','creator:id,username'])
            ->orderByDesc('created_at')
            ->get();
        // Normalize preview url for course-scoped list
        try {
            foreach ($quizzes as $q) {
                if (!empty($q->preview_image_url)) {
                    try {
                        $key = StorageHelper::urlToS3Key($q->preview_image_url) ?: null;
                        if (!$key) {
                            $cands = [
                                "preview_images/{$q->id}/image",
                                "preview_images/{$q->id}/image.jpg",
                                "preview_images/{$q->id}/image.jpeg",
                                "preview_images/{$q->id}/image.png",
                                "preview_images/{$q->id}/image.webp",
                            ];
                            foreach ($cands as $cand) { if (Storage::disk('s3')->exists($cand)) { $key = $cand; break; } }
                        }
                        if ($key) {
                            $ver = Storage::disk('s3')->lastModified($key);
                            if ($ver) { $sep = str_contains($q->preview_image_url, '?') ? '&' : '?'; $q->preview_image_url = $q->preview_image_url . $sep . 'v=' . $ver; }
                        }
                    } catch (\Throwable $__) {}
                }
            }
        } catch (\Throwable $__) {}

        return response()->json($quizzes)->header('Cache-Control', 'private, max-age=30');
    }
}
