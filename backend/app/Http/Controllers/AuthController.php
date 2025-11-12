<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function signup(Request $request)
    {
        $validated = $request->validate([
            'username' => ['required', 'string', 'max:50', 'alpha_num', 'unique:users,username'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', Rule::in(['student', 'teacher'])],
        ], [
            'username.required' => 'Username is required.',
            'username.alpha_num' => 'Username may only contain letters and numbers.',
            'username.unique' => 'Username is already taken.',
            'email.required' => 'Email is required.',
            'email.email' => 'Please provide a valid email address.',
            'email.unique' => 'An account already exists with this email.',
            'password.required' => 'Password is required.',
            'password.min' => 'Password must be at least 8 characters.',
            'role.required' => 'Role is required.',
            'role.in' => 'Role must be either student or teacher.',
        ]);

        $user = User::create([
            'username' => $validated['username'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'name' => $validated['username'],
        ]);

        return response()->json([
            'message' => 'Signup successful',
            'user' => [
                'userID' => $user->{$user->getKeyName()},
                'username' => $user->username,
                'email' => $user->email,
                'role' => $user->role,
                'profile_image' => $user->profile_image,
                'is_verified' => (bool)$user->is_verified,
                'is_admin' => (bool)$user->is_admin,
            ],
        ], 201);
    }

    public function login(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'role' => ['required', Rule::in(['student', 'teacher'])],
        ], [
            'email.required' => 'Email is required.',
            'email.email' => 'Please provide a valid email address.',
            'password.required' => 'Password is required.',
            'role.required' => 'Role is required.',
            'role.in' => 'Role must be either student or teacher.',
        ]);

        $user = User::where('email', $validated['email'])->first();
        if (!$user) {
            return response()->json([
                'message' => 'No account found for this email.',
                'field' => 'email',
            ], 404);
        }
        if (!Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'message' => 'Incorrect password.',
                'field' => 'password',
            ], 422);
        }

        if ($user->role !== $validated['role']) {
            return response()->json([
                'message' => 'Selected role does not match your account.',
                'expectedRole' => $user->role,
            ], 422);
        }

        $token = $user->createToken('auth')->plainTextToken;

        return response()->json([
            'message' => 'Login successful',
            'token' => $token,
            'user' => [
                'userID' => $user->{$user->getKeyName()},
                'username' => $user->username,
                'email' => $user->email,
                'role' => $user->role,
                'profile_image' => $user->profile_image,
                'is_verified' => (bool)$user->is_verified,
                'is_admin' => (bool)$user->is_admin,
            ],
            'redirect' => $user->is_admin ? '/admin/dashboard' : '/dashboard',
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();
        if ($user) {
            $user->currentAccessToken()?->delete();
        }
        return response()->json(['message' => 'Logged out']);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        return response()->json([
            'user' => [
                'userID' => $user?->{$user->getKeyName()},
                'username' => $user?->username,
                'email' => $user?->email,
                'role' => $user?->role,
                'profile_image' => $user?->profile_image,
                'is_verified' => (bool)($user?->is_verified ?? false),
                'is_admin' => (bool)($user?->is_admin ?? false),
            ],
        ]);
    }
}
