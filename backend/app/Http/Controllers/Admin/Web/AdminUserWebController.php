<?php

namespace App\Http\Controllers\Admin\Web;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class AdminUserWebController extends Controller
{
    public function index(Request $request)
    {
        return response()->json([
            'page' => 'admin.users',
            'message' => 'Admin users index placeholder',
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

    public function reset(Request $request)
    {
        return response()->json([
            'action' => 'reset',
            'status' => 'ok',
        ]);
    }
}
