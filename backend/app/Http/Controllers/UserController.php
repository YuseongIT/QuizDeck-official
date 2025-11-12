<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function profile(Request $request)
    {
        $u = $request->user();
        return response()->json([
            'success' => true,
            'user' => [
                'userID' => $u?->{$u->getKeyName()},
                'username' => $u?->username,
                'email' => $u?->email,
                'role' => $u?->role,
            ],
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->user();
        $validated = $request->validate([
            'username' => ['sometimes', 'required', 'string', 'max:50', 'alpha_num', Rule::unique('users', 'username')->ignore($user->{$user->getKeyName()})],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->{$user->getKeyName()})],
        ]);

        if (array_key_exists('username', $validated)) {
            $user->username = $validated['username'];
            $user->name = $validated['username'];
        }
        if (array_key_exists('email', $validated)) {
            $user->email = $validated['email'];
        }
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully.',
            'user' => [
                'userID' => $user->{$user->getKeyName()},
                'username' => $user->username,
                'email' => $user->email,
                'role' => $user->role,
            ],
        ]);
    }

    public function updatePassword(Request $request)
    {
        $user = $request->user();
        $validated = $request->validate([
            'currentPassword' => ['required', 'string'],
            'newPassword' => ['required', 'string', 'min:8'],
            'confirmNewPassword' => ['required', 'same:newPassword'],
        ], [
            'currentPassword.required' => 'Current password is required.',
            'newPassword.min' => 'New password must be at least 8 characters.',
            'confirmNewPassword.same' => 'Passwords do not match.',
        ]);

        if (!\Illuminate\Support\Facades\Hash::check($validated['currentPassword'], $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Current password is incorrect.',
            ], 422);
        }

        $user->password = \Illuminate\Support\Facades\Hash::make($validated['newPassword']);
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Password updated successfully.',
        ]);
    }

    public function destroy(Request $request)
    {
        $user = $request->user();
        $validated = $request->validate([
            'currentPassword' => ['required', 'string'],
        ], [
            'currentPassword.required' => 'Current password is required to delete the account.',
        ]);

        if (!\Illuminate\Support\Facades\Hash::check($validated['currentPassword'], $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Current password is incorrect.',
            ], 422);
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json([
            'success' => true,
            'message' => 'Account deleted successfully.',
        ]);
    }
}
