<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Quiz;

class QuizController extends Controller
{
    public function index()
    {
        try {
            $rows = Quiz::select(['id','title','description','published','visibility','created_at'])
                ->orderByDesc('created_at')->get();
            return response()->json($rows);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    public function show($id)
    {
        try {
            $row = Quiz::findOrFail($id);
            return response()->json($row);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    public function update(Request $request, $id)
    {
        try {
            $row = Quiz::findOrFail($id);
            $data = $request->validate([
                'title' => ['sometimes','string','max:255'],
                'description' => ['sometimes','nullable','string'],
                'published' => ['sometimes','boolean'],
                'visibility' => ['sometimes','in:draft,private,public,unlisted'],
            ]);
            foreach ($data as $k=>$v) { $row->{$k} = $v; }
            $row->save();
            return response()->json(['message' => 'Quiz updated', 'quiz' => $row]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    public function destroy($id)
    {
        try {
            $row = Quiz::findOrFail($id);
            $row->delete();
            return response()->json(['message' => 'Quiz deleted']);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }
}
