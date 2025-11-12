<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Cache;

class AnnouncementController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $cacheKey = 'anns:index:v1:user:' . ($user->id ?? 0) . ':role:' . ($user->role ?? '');
        $anns = Cache::remember($cacheKey, now()->addSeconds(60), function () use ($user) {
            if ($user->role === 'teacher') {
                return Announcement::where('teacher_id', $user->id)
                    ->with(['course:id,name,course_code','teacher:id,username'])
                    ->orderByDesc('created_at')
                    ->get(['id','teacher_id','course_id','title','message','created_at']);
            }
            $courseIds = Enrollment::where('user_id', $user->id)->pluck('course_id');
            return Announcement::whereIn('course_id', $courseIds)
                ->with(['course:id,name,course_code', 'teacher:id,username'])
                ->orderByDesc('created_at')
                ->get(['id','teacher_id','course_id','title','message','created_at']);
        });
        return response()->json($anns)->header('Cache-Control', 'private, max-age=30');
    }

    // POST /api/courses/{id}/announcements (teacher only)
    public function store(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'teacher') {
            return response()->json(['message' => 'Only teachers can post announcements'], 403);
        }

        $data = $request->validate([
            'title' => ['required','string','max:255'],
            'message' => ['required','string'],
        ]);

        $courseId = (int) $id;
        $ownsCourse = Course::where('id', $courseId)->where('teacher_id', $user->id)->exists();
        if (!$ownsCourse) return response()->json(['message' => 'You do not own this course'], 403);

        $ann = Announcement::create([
            'teacher_id' => $user->id,
            'course_id' => $courseId,
            'title' => $data['title'],
            'message' => $data['message'],
        ]);

        // Create notifications for enrolled students (exclude the teacher)
        try {
            $enrolledUserIds = Enrollment::where('course_id', $courseId)
                ->where('user_id', '!=', $user->id)
                ->pluck('user_id')
                ->all();
            $courseName = null; try { $courseName = optional(Course::find($courseId))->name; } catch (\Throwable $__) { $courseName = null; }
            $bulk = [];
            $now = now();
            foreach ($enrolledUserIds as $uid) {
                $bulk[] = [
                    'user_id' => $uid,
                    'type' => 'announcement',
                    'data' => json_encode([
                        'course_id' => $courseId,
                        'course_name' => $courseName,
                        'title' => $data['title'],
                        'message' => $data['message'],
                        'announcement_id' => $ann->id,
                    ]),
                    'read' => false,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            if (!empty($bulk)) {
                Notification::insert($bulk);
            }
        } catch (\Throwable $__) {}

        return response()->json($ann, 201);
    }

    // DELETE /api/announcements/{id} (teacher only)
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'teacher') return response()->json(['message' => 'Only teachers can delete announcements'], 403);
        $ann = Announcement::findOrFail($id);
        // ensure ownership by teacher
        $ownsCourse = Course::where('id', $ann->course_id)->where('teacher_id', $user->id)->exists();
        if (!$ownsCourse) return response()->json(['message' => 'You do not own this course'], 403);
        $ann->delete();
        return response()->json(['success' => true]);
    }

    // PATCH /api/announcements/{id} (teacher only)
    public function update(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'teacher') return response()->json(['message' => 'Only teachers can edit announcements'], 403);
        $ann = Announcement::findOrFail($id);
        // ensure ownership by teacher
        $ownsCourse = Course::where('id', $ann->course_id)->where('teacher_id', $user->id)->exists();
        if (!$ownsCourse) return response()->json(['message' => 'You do not own this course'], 403);

        $data = $request->validate([
            'title' => ['sometimes','string','max:255'],
            'message' => ['sometimes','string'],
        ]);
        if (array_key_exists('title', $data)) $ann->title = $data['title'];
        if (array_key_exists('message', $data)) $ann->message = $data['message'];
        $ann->save();
        return response()->json($ann);
    }

    // POST /api/announcements/dismiss { ids: [announcementIds...] }
    public function dismiss(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'ids' => ['required','array'],
            'ids.*' => ['integer']
        ]);
        $ids = array_unique($data['ids'] ?? []);
        foreach ($ids as $aid) {
            try {
                \DB::table('announcement_dismissals')->updateOrInsert(
                    ['user_id' => $user->id, 'announcement_id' => $aid],
                    ['updated_at' => now(), 'created_at' => now()]
                );
            } catch (\Throwable $__) {}
        }
        return response()->json(['ok' => true, 'ids' => $ids]);
    }
}
