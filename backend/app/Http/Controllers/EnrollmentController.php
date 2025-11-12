<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Enrollment;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EnrollmentController extends Controller
{
    public function store(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'student') {
            return response()->json(['message' => 'Only students can enroll'], 403);
        }

        $data = $request->validate([
            'course_id' => ['nullable','integer', Rule::exists('courses','id')],
            'course_code' => ['nullable','string','max:64'],
        ]);

        $course = null;
        if (!empty($data['course_id'])) {
            $course = Course::find($data['course_id']);
        } elseif (!empty($data['course_code'])) {
            $course = Course::where('course_code', $data['course_code'])->first();
        }
        if (!$course) return response()->json(['message' => 'Course not found'], 404);

        $exists = Enrollment::where('user_id', $user->id)->where('course_id', $course->id)->exists();
        if ($exists) return response()->json(['message' => 'Already enrolled'], 409);

        $enr = Enrollment::create(['user_id' => $user->id, 'course_id' => $course->id]);
        return response()->json($enr, 201);
    }

    public function destroy(Request $request, Enrollment $enrollment)
    {
        $user = $request->user();
        if ($enrollment->user_id !== $user->id) return response()->json(['message' => 'Not allowed'], 403);
        $enrollment->delete();
        return response()->json(['ok' => true]);
    }

    // Alias: enroll by course path param
    public function enrollByCourseId(Request $request, $course)
    {
        $request->merge(['course_id' => intval($course)]);
        return $this->store($request);
    }
}
