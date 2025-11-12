<?php

use Illuminate\Support\Facades\Route;
// verification removed
use App\Http\Controllers\Admin\Web\AdminDashboardController;
use App\Http\Controllers\Admin\Web\AdminUserWebController;
use App\Http\Controllers\Admin\Web\AdminCourseWebController;
use App\Http\Controllers\Admin\Web\AdminQuizWebController;

Route::get('/', function () {
    return view('welcome');
});

// removed verification callback route

use App\Http\Middleware\IsAdmin;

Route::middleware(['web','auth:sanctum', IsAdmin::class])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/dashboard', [AdminDashboardController::class, 'index'])->name('dashboard');
    // Users
    Route::get('/users', [AdminUserWebController::class, 'index'])->name('users');
    Route::post('/users/{id}', [AdminUserWebController::class, 'update'])->name('users.update');
    Route::delete('/users/{id}', [AdminUserWebController::class, 'destroy'])->name('users.destroy');
    Route::post('/users/reset', [AdminUserWebController::class, 'reset'])->name('users.reset');
    // Courses
    Route::get('/courses', [AdminCourseWebController::class, 'index'])->name('courses');
    Route::post('/courses/{id}', [AdminCourseWebController::class, 'update'])->name('courses.update');
    Route::delete('/courses/{id}', [AdminCourseWebController::class, 'destroy'])->name('courses.destroy');
    // Quizzes
    Route::get('/quizzes', [AdminQuizWebController::class, 'index'])->name('quizzes');
    Route::post('/quizzes/{id}', [AdminQuizWebController::class, 'update'])->name('quizzes.update');
    Route::delete('/quizzes/{id}', [AdminQuizWebController::class, 'destroy'])->name('quizzes.destroy');
});
