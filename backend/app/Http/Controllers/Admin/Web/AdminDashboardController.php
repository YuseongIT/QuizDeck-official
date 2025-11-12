<?php

namespace App\Http\Controllers\Admin\Web;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class AdminDashboardController extends Controller
{
    public function index(Request $request)
    {
        return response()->json([
            'page' => 'admin.dashboard',
            'message' => 'Admin dashboard placeholder',
        ]);
    }
}
