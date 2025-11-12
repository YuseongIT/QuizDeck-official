<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\CourseController;
use App\Http\Controllers\QuizController;
use App\Http\Controllers\QuizItemController;
use App\Http\Controllers\QuizAttemptController;
use App\Http\Controllers\GradesController;
use App\Http\Controllers\FriendController;
use App\Http\Controllers\AnnouncementController;
use App\Http\Controllers\ActivityController;
use App\Http\Controllers\EnrollmentController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\ProfileController;
// removed EmailVerificationController (verification feature rolled back)
use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\Admin\CourseController as AdminCourseController;
use App\Http\Controllers\Admin\QuizController as AdminQuizController;
use App\Models\Notification;

Route::get('/health', function () {
    return response()->json(['ok' => true]);
});

Route::get('/time', function () {
    return response()->json(['serverTime' => now()->toISOString()]);
});

Route::get('/db-ping', function () {
    $diag = [
        'connection' => env('DB_CONNECTION'),
        'host' => env('DB_HOST'),
        'database' => env('DB_DATABASE'),
        'port' => env('DB_PORT'),
    ];
    try {
        DB::connection()->getPdo();
        $row = DB::select('SELECT 1 as ok');
        return response()->json([
            'db' => 'ok',
            'result' => $row[0]->ok ?? 1,
            'diagnostics' => $diag,
        ]);
    } catch (\Throwable $e) {
        $error = [
            'db' => 'error',
            'message' => $e->getMessage(),
            'code' => method_exists($e, 'getCode') ? $e->getCode() : null,
            'diagnostics' => $diag,
        ];
        Log::error('DB-PING failed', $error + ['trace' => $e->getTraceAsString()]);
        return response()->json($error, 500);
    }
});

// Public file proxy for storage/app/public to work reliably in dev and Windows
Route::get('/storage/{path}', function ($path) {
    $safePath = str_replace(['..','\\'], ['','.'], $path);
    $full = storage_path('app/public/' . $safePath);
    if (!File::exists($full)) {
        return response()->json(['message' => 'Not found'], 404);
    }
    $mime = File::mimeType($full) ?: 'application/octet-stream';
    return response()->file($full, [
        'Content-Type' => $mime,
        'Cache-Control' => 'public, max-age=604800',
    ]);
})->where('path', '.*');

// Auth endpoints
Route::post('/signup', [AuthController::class, 'signup']);
Route::post('/login', [AuthController::class, 'login']);

Route::middleware(['App\Http\Middleware\ForceJsonApi','auth:sanctum'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/user', [AuthController::class, 'me']);


    // Settings: profile and account management
    Route::get('/user/profile', [UserController::class, 'profile']);
    Route::put('/user/update', [UserController::class, 'update']);
    Route::put('/user/update-password', [UserController::class, 'updatePassword']);
    Route::delete('/user/delete', [UserController::class, 'destroy']);

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Student course actions (role enforced in controllers)
    Route::get('/courses/public', [CourseController::class, 'discover']);

    // Shared course read (constrain {id} to numbers so it doesn't capture 'public')
    Route::get('/courses/{id}', [CourseController::class, 'show'])->whereNumber('id');

    // Course management (role enforced in controllers)
    Route::get('/courses', [CourseController::class, 'myCreated']);
    Route::get('/courses/my', [CourseController::class, 'myCreated']);
    Route::post('/courses', [CourseController::class, 'store']);
    Route::patch('/courses/{id}', [CourseController::class, 'update']);
    Route::delete('/courses/{id}', [CourseController::class, 'destroy']);
    Route::post('/courses/{id}/announcements', [AnnouncementController::class, 'store']);
    Route::delete('/announcements/{id}', [AnnouncementController::class, 'destroy']);
    Route::patch('/announcements/{id}', [AnnouncementController::class, 'update']);
    Route::post('/announcements/dismiss', [AnnouncementController::class, 'dismiss']);
    Route::get('/courses/{id}/students', [CourseController::class, 'listStudents']);
    // Student view: classmates list (requires enrollment)
    Route::get('/courses/{id}/classmates', [CourseController::class, 'classmates']);
    Route::delete('/courses/{id}/students/{user_id}', [CourseController::class, 'removeStudent']);

    // Student course actions (continued)
    Route::post('/courses/{id}/join', [CourseController::class, 'join'])->whereNumber('id');
    Route::post('/courses/{code}/join', [CourseController::class, 'joinByCode']);
    Route::post('/courses/{id}/leave', [CourseController::class, 'leave']);
    Route::get('/me/courses', [CourseController::class, 'myCourses']);

    // Quizzes
    Route::get('/quizzes', [QuizController::class, 'index']);
    Route::post('/quizzes', [QuizController::class, 'store']);
    Route::get('/my-quizzes', [QuizController::class, 'index']);
    Route::get('/quizzes/{course}', [QuizController::class, 'byCourse'])->whereNumber('course');
    Route::get('/quiz/{id}', [QuizController::class, 'show'])->whereNumber('id');
    // Context alias
    Route::get('/quizzes/{id}', [QuizController::class, 'show'])->whereNumber('id');
    Route::patch('/quizzes/{id}', [QuizController::class, 'update'])->whereNumber('id');
    Route::delete('/quizzes/{id}', [QuizController::class, 'destroy'])->whereNumber('id');
    Route::patch('/quizzes/{id}/publish', [QuizController::class, 'publish'])->whereNumber('id');
    Route::patch('/quizzes/{id}/toggle', [QuizController::class, 'toggle'])->whereNumber('id');
    // New: preview image upload and autosave endpoints
    Route::post('/quizzes/{id}/preview-image', [QuizController::class, 'uploadPreview'])->whereNumber('id');
    Route::patch('/quizzes/{id}/autosave', [QuizController::class, 'autosave'])->whereNumber('id');

    // Quiz Items
    Route::get('/quiz-items/{quiz_id}', [QuizItemController::class, 'index'])->whereNumber('quiz_id');
    Route::post('/quiz-items', [QuizItemController::class, 'store']);
    Route::patch('/quiz-items/{id}', [QuizItemController::class, 'update'])->whereNumber('id');
    Route::delete('/quiz-items/{id}', [QuizItemController::class, 'destroy'])->whereNumber('id');
    Route::post('/quiz-items/{id}/image', [QuizItemController::class, 'uploadImage'])->whereNumber('id');
    Route::delete('/quiz-items/{id}/image', [QuizItemController::class, 'deleteImage'])->whereNumber('id');
    // Media (audio/video) for items
    Route::post('/quiz-items/{id}/media', [QuizItemController::class, 'uploadMedia'])->whereNumber('id');
    Route::delete('/quiz-items/{id}/media', [QuizItemController::class, 'deleteMedia'])->whereNumber('id');

    // Quiz Attempts
    Route::post('/quiz-attempts', [QuizAttemptController::class, 'start']);
    Route::patch('/quiz-attempts/{id}/autosave', [QuizAttemptController::class, 'autosave'])->whereNumber('id');
    Route::patch('/quiz-attempts/{id}/submit', [QuizAttemptController::class, 'submit'])->whereNumber('id');
    Route::delete('/quiz-attempts/{id}', [QuizAttemptController::class, 'destroy'])->whereNumber('id');

    // Grades
    Route::get('/grades', [GradesController::class, 'index']);

    // Friends
    Route::get('/friends', [FriendController::class, 'index']);
    Route::post('/friends', [FriendController::class, 'store']);
    Route::put('/friends/{friend}', [FriendController::class, 'update']);
    Route::delete('/friends/{friend}', [FriendController::class, 'destroy']);
    // Username-based
    Route::post('/friends/accept/{username}', [FriendController::class, 'acceptByUsername']);
    // Friend requests flow
    Route::post('/friends/send', [FriendController::class, 'sendRequest']);
    Route::post('/friends/accept', [FriendController::class, 'acceptRequest']);
    Route::post('/friends/reject', [FriendController::class, 'rejectRequest']);
    Route::get('/friends/requests', [FriendController::class, 'getRequests']);
    // Spec-compliant aliases
    Route::get('/friends/search', [FriendController::class, 'search']);
    Route::post('/friends/request', [FriendController::class, 'sendRequest']); // supports receiver_id or receiver_username
    // New explicit remove-by-user-id endpoint to avoid collision with /friends/{friend}
    Route::delete('/friends/remove/{id}', [FriendController::class, 'removeByUserId']); // {id} is other user's id
    Route::delete('/friends/remove', [FriendController::class, 'remove']); // legacy: body { friend_id }
    Route::get('/friends/list', [FriendController::class, 'index']);
    Route::get('/friends/{userId}', [FriendController::class, 'friendsOf']);

    // Announcements
    Route::get('/announcements', [AnnouncementController::class, 'index']);
    Route::post('/announcements', [AnnouncementController::class, 'store']);

    // Activity
    Route::get('/activity', [ActivityController::class, 'index']);

    // Search
    Route::get('/search', [SearchController::class, 'index']);

    // Profile
    Route::get('/profile', [ProfileController::class, 'me']);
    Route::get('/profile/{username}', [ProfileController::class, 'show']);
    Route::post('/profile/upload', [ProfileController::class, 'upload']);
    Route::post('/profile/bio', [ProfileController::class, 'updateBio']);

    // Notifications
    Route::get('/notifications', function (Request $request) {
        $user = $request->user();
        $rows = Notification::where('user_id', $user->id)
            ->orderBy('read')
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();
        return response()->json($rows);
    });
    Route::post('/notifications/read', function (Request $request) {
        $user = $request->user();
        $ids = $request->input('ids');
        $all = filter_var((string)$request->input('all', ''), FILTER_VALIDATE_BOOLEAN);
        $q = Notification::where('user_id', $user->id)->where('read', false);
        if (!$all && is_array($ids) && count($ids) > 0) {
            $q->whereIn('id', $ids);
        }
        $count = $q->update(['read' => true]);
        return response()->json(['updated' => $count]);
    });

    // Enrollments
    Route::post('/enrollments', [EnrollmentController::class, 'store']);
    Route::delete('/enrollments/{enrollment}', [EnrollmentController::class, 'destroy']);

    // Admin endpoints
    Route::prefix('admin')->middleware('is_admin')->group(function () {
        // Users
        Route::get('/users', [AdminUserController::class, 'index']);
        Route::put('/users/{id}', [AdminUserController::class, 'update'])->whereNumber('id');
        Route::delete('/users/{id}', [AdminUserController::class, 'destroy'])->whereNumber('id');
        Route::post('/users/reset', [AdminUserController::class, 'resetUsers']);

        // Courses
        Route::get('/courses', [AdminCourseController::class, 'index']);
        Route::get('/courses/{id}', [AdminCourseController::class, 'show'])->whereNumber('id');
        Route::put('/courses/{id}', [AdminCourseController::class, 'update'])->whereNumber('id');
        Route::delete('/courses/{id}', [AdminCourseController::class, 'destroy'])->whereNumber('id');

        // Quizzes
        Route::get('/quizzes', [AdminQuizController::class, 'index']);
        Route::get('/quizzes/{id}', [AdminQuizController::class, 'show'])->whereNumber('id');
        Route::put('/quizzes/{id}', [AdminQuizController::class, 'update'])->whereNumber('id');
        Route::delete('/quizzes/{id}', [AdminQuizController::class, 'destroy'])->whereNumber('id');
    });
});

