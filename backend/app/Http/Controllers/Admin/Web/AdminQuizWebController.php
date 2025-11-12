<?php

namespace App\Http\Controllers\Admin\Web;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class AdminQuizWebController extends Controller
{
    public function index(Request $request)
    {
        return response()->json([
            'page' => 'admin.quizzes',
            'message' => 'Admin quizzes index placeholder',
        ]);
    }

    public function update($id, Request $request)
    {
        return response()->json([
            'action' => 'update',
            'id' => (int) $id,
            'status' => 'ok',
        ]);
    }

    public function destroy($id)
    {
        return response()->json([
            'action' => 'destroy',
            'id' => (int) $id,
            'status' => 'ok',
        ]);
    }
}
