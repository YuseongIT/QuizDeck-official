<?php

namespace App\Http\Controllers\Admin\Web;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class AdminCourseWebController extends Controller
{
    public function index(Request $request)
    {
        return response()->json([
            'page' => 'admin.courses',
            'message' => 'Admin courses index placeholder',
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
