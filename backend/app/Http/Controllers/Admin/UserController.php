<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index()
    {
        try {
            $users = User::select(['id','username','email','role','is_admin','created_at'])
                ->orderByDesc('created_at')->get();
            return response()->json($users);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $data = $request->validate([
            'username' => ['sometimes','string','max:50'],
            'email' => ['sometimes','email','max:255'],
            'role' => ['sometimes','in:student,teacher'],
            'is_verified' => ['sometimes','boolean'],
            'is_admin' => ['sometimes','boolean'],
            'password' => ['sometimes','nullable','string','min:8'],
        ]);
        if (isset($data['password']) && $data['password']) {
            $user->password = Hash::make($data['password']);
            unset($data['password']);
        }
        $user->fill($data);
        if (isset($data['is_verified']) && $data['is_verified'] && empty($user->email_verified_at)) {
            $user->email_verified_at = now();
        }
        $user->save();
        return response()->json(['message' => 'User updated','user' => $user]);
    }

    public function destroy($id)
    {
        $user = User::findOrFail($id);
        if ($user->is_admin) {
            return response()->json(['message' => 'Cannot delete admin'], 422);
        }
        $user->delete();
        return response()->json(['message' => 'User deleted']);
    }

    public function resetUsers()
    {
        $count = User::where('is_admin', false)->delete();
        return response()->json(['message' => 'All non-admin users deleted','deleted' => $count]);
    }
}
