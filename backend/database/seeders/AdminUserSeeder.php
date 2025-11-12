<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $email = 'quizdeckadmin123@gmail.com';
        $user = User::where('email', $email)->first();
        if (!$user) {
            User::create([
                'name' => 'QuizDeck Admin',
                'username' => 'quizdeckadmin',
                'email' => $email,
                'password' => Hash::make('quizdeckisthebest'),
                'role' => 'teacher',
                'is_verified' => true,
                'email_verified_at' => now(),
                'is_admin' => true,
            ]);
        } else {
            $user->update([
                'is_admin' => true,
                'is_verified' => true,
                'email_verified_at' => $user->email_verified_at ?: now(),
            ]);
        }
    }
}
