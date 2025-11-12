<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use App\Models\User;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Friend;
use App\Models\FriendRequest;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;

class ProfileController extends Controller
{
    public function me(Request $request)
    {
        $user = $request->user();

        $cacheKey = 'profile:me:v1:user:' . ($user->id ?? 0);
        $payload = Cache::remember($cacheKey, now()->addSeconds(45), function () use ($user) {
            if ($user->role === 'teacher') {
                $courses = Course::where('teacher_id', $user->id)
                    ->select('id','name as title','created_at')
                    ->orderBy('name')
                    ->get();
            } else {
                $courses = Enrollment::where('user_id', $user->id)
                    ->join('courses','enrollments.course_id','=','courses.id')
                    ->select('courses.id','courses.name as title','enrollments.created_at as enrolled_at')
                    ->orderBy('courses.name')
                    ->get();
            }

            $friends = Friend::where(function ($q) use ($user) {
                    $q->where('user_id', $user->id)->orWhere('friend_id', $user->id);
                })
                ->with([
                    'user:id,username,profile_image',
                    'friend:id,username,profile_image'
                ])
                ->get(['id','user_id','friend_id','status']);

            return [
                'id' => $user->id,
                'username' => $user->username,
                'email' => $user->email,
                'role' => $user->role,
                'profile_image' => $user->profile_image,
                'status' => $user->status,
                'bio' => $user->bio,
                'join_date' => optional($user->created_at)->format('F Y'),
                'courses' => $courses,
                'friends' => $friends,
            ];
        });

        return response()->json($payload)->header('Cache-Control', 'private, max-age=30');
    }

    public function show(Request $request, $username)
    {
        $viewer = $request->user();
        $userQuery = User::where('username', $username);
        if (Schema::hasColumn('users', 'profile_image')) {
            // Also include status and bio so they are not null when returning
            $columns = ['id','username','role','profile_image'];
        } else {
            $columns = ['id','username','role'];
        }
        if (Schema::hasColumn('users', 'status')) { $columns[] = 'status'; }
        if (Schema::hasColumn('users', 'bio')) { $columns[] = 'bio'; }
        $userQuery->select($columns);
        $user = $userQuery->first();
        if (!$user) return response()->json(['message' => 'User not found'], 404);

        $payload = Cache::remember('profile:show:v1:username:' . strtolower($username) . ':viewer:' . ($viewer->id ?? 0), now()->addSeconds(45), function () use ($viewer, $username) {
            $userQuery = User::where('username', $username);
            if (Schema::hasColumn('users', 'profile_image')) {
                $columns = ['id','username','role','profile_image'];
            } else {
                $columns = ['id','username','role'];
            }
            if (Schema::hasColumn('users', 'status')) { $columns[] = 'status'; }
            if (Schema::hasColumn('users', 'bio')) { $columns[] = 'bio'; }
            $userQuery->select($columns);
            $user = $userQuery->first();
            if (!$user) return ['_404' => true];

            if ($user->role === 'teacher') {
                $courses = Course::where('teacher_id', $user->id)
                    ->select('id','name as title','created_at')
                    ->orderBy('name')
                    ->get();
            } else {
                $courses = Enrollment::where('user_id', $user->id)
                    ->join('courses','enrollments.course_id','=','courses.id')
                    ->select('courses.id','courses.name as title','enrollments.created_at as enrolled_at')
                    ->orderBy('courses.name')
                    ->get();
            }

            $friends = Friend::where(function ($q) use ($user) {
                    $q->where('user_id', $user->id)->orWhere('friend_id', $user->id);
                })
                ->with(['user:id,username,profile_image','friend:id,username,profile_image'])
                ->get(['id','user_id','friend_id','status']);

            $isFriend = Friend::where(function ($q) use ($viewer, $user) {
                $q->where('user_id', $viewer->id)->where('friend_id', $user->id);
            })->orWhere(function ($q) use ($viewer, $user) {
                $q->where('user_id', $user->id)->where('friend_id', $viewer->id);
            })->where('status','accepted')->exists();

            $legacyIncoming = Friend::where('user_id', $user->id)->where('friend_id', $viewer->id)->where('status','pending')->exists();
            $legacyOutgoing = Friend::where('user_id', $viewer->id)->where('friend_id', $user->id)->where('status','pending')->exists();
            $newIncoming = Schema::hasTable('friend_requests') ? FriendRequest::where('sender_id', $user->id)->where('receiver_id', $viewer->id)->where('status','pending')->exists() : false;
            $newOutgoing = Schema::hasTable('friend_requests') ? FriendRequest::where('sender_id', $viewer->id)->where('receiver_id', $user->id)->where('status','pending')->exists() : false;
            $pendingFromOther = $legacyIncoming || $newIncoming;
            $pendingFromViewer = $legacyOutgoing || $newOutgoing;

            return [
                '_user' => $user,
                'courses' => $courses,
                'friends' => $friends,
                'isFriend' => $isFriend,
                'pendingFromOther' => $pendingFromOther,
                'pendingFromViewer' => $pendingFromViewer,
            ];
        });

        if (isset($payload['_404']) && $payload['_404']) return response()->json(['message' => 'User not found'], 404);

        $user = $payload['_user'];
        $courses = $payload['courses'];
        $friends = $payload['friends'];
        $isFriend = $payload['isFriend'];
        $pendingFromOther = $payload['pendingFromOther'];
        $pendingFromViewer = $payload['pendingFromViewer'];

        return response()->json([
            'id' => $user->id,
            'username' => $user->username,
            'role' => $user->role,
            'profile_image' => $user->profile_image,
            'status' => $user->status,
            'bio' => $user->bio,
            'join_date' => optional($user->created_at)->format('F Y'),
            'courses' => $courses,
            'is_friend' => $isFriend,
            'pending_from_other' => $pendingFromOther,
            'pending_from_viewer' => $pendingFromViewer,
            'friends' => $friends,
        ])->header('Cache-Control', 'private, max-age=30');
    }

    public function upload(Request $request)
    {
        try {
            $user = $request->user();
            $request->validate([
                'image' => ['required','file','image','mimes:jpg,jpeg,png,webp','max:10240'] // up to 10MB
            ]);

            // Prefer S3 if configured as default disk
            $disk = config('filesystems.default', 'public');
            $backendPath = null; // value to persist in DB
            $publicUrl = null;   // value to return to clients for immediate rendering

            if ($disk === 's3') {
                $stored = $request->file('image')->store('profile_images', 's3');
                $publicUrl = \Illuminate\Support\Facades\Storage::disk('s3')->url($stored);
                $backendPath = $publicUrl; // for S3 we store full URL
            } else {
                // local public storage
                $stored = $request->file('image')->store('profile_images', 'public');
                $backendPath = '/storage/'.$stored; // keep legacy relative path
                $publicUrl = $backendPath; // frontend converts via toImageUrl
            }

            $user->profile_image = $backendPath;
            $user->save();

            // Optional: create notification and broadcast event if tables/channels exist
            try {
                if (\Illuminate\Support\Facades\Schema::hasTable('notifications')) {
                    \App\Models\Notification::create([
                        'user_id' => $user->id,
                        'type' => 'profile_image_updated',
                        'data' => ['image_url' => $publicUrl],
                        'read' => false,
                    ]);
                }
                if (class_exists('App\\Events\\ProfileImageUpdated')) {
                    broadcast(new \App\Events\ProfileImageUpdated($user, $publicUrl))->toOthers();
                }
            } catch (\Throwable $e) {
                // swallow notification errors to not block upload
            }

            return response()->json([
                'success' => true,
                'imageUrl' => $publicUrl,
                'profile_image' => $backendPath,
            ]);
        } catch (\Illuminate\Validation\ValidationException $ve) {
            return response()->json([
                'success' => false,
                'message' => $ve->getMessage(),
                'errors' => $ve->errors(),
            ], 422);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Upload failed',
            ], 500);
        }
    }

    public function updateBio(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'bio' => ['nullable','string','max:300'],
            'status' => ['nullable','string','max:100'],
        ]);
        $user->bio = $data['bio'] ?? null;
        $user->status = $data['status'] ?? null;
        $user->save();
        return response()->json([
            'status' => $user->status,
            'bio' => $user->bio,
        ]);
    }
}
