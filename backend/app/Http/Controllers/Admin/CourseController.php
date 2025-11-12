<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Course;

class CourseController extends Controller
{
    public function index()
    {
        try {
            $rows = Course::select(['id','title','created_at'])
                ->orderByDesc('created_at')->get();
            return response()->json($rows);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    public function show($id)
    {
        try {
            $row = Course::findOrFail($id);
            return response()->json($row);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    public function update(Request $request, $id)
    {
        try {
            $row = Course::findOrFail($id);
            $data = $request->validate([
                'title' => ['sometimes','string','max:255'],
                'description' => ['sometimes','nullable','string'],
                'visibility' => ['sometimes','in:private,public,unlisted'],
                'teacher_id' => ['sometimes','integer'],
            ]);
            foreach ($data as $k=>$v) { $row->{$k} = $v; }
            $row->save();
            return response()->json(['message' => 'Course updated', 'course' => $row]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    public function destroy($id)
    {
        try {
            $row = Course::findOrFail($id);
            $row->delete();
            return response()->json(['message' => 'Course deleted']);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }
}
