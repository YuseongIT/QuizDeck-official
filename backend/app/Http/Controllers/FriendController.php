<?php

namespace App\Http\Controllers;

use App\Models\Friend;
use App\Models\User;
use App\Models\FriendRequest;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;

class FriendController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $friends = Friend::where(function ($q) use ($user) {
                $q->where('user_id', $user->id)
                  ->orWhere('friend_id', $user->id);
            })
            ->with(['user','friend'])
            ->orderByDesc('created_at')
            ->get();
        return response()->json($friends)->header('Cache-Control', 'private, max-age=30');
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'friend_id' => ['required','integer', Rule::exists('users','id')],
        ]);
        if ($data['friend_id'] === $user->id) return response()->json(['message' => 'Cannot friend yourself'], 422);

        $exists = Friend::where(function ($q) use ($user, $data) {
                $q->where('user_id', $user->id)->where('friend_id', $data['friend_id']);
            })->orWhere(function ($q) use ($user, $data) {
                $q->where('user_id', $data['friend_id'])->where('friend_id', $user->id);
            })->exists();
        if ($exists) return response()->json(['message' => 'Friendship already exists or pending'], 409);

        $fr = Friend::create([
            'user_id' => $user->id,
            'friend_id' => $data['friend_id'],
            'status' => 'pending',
        ]);
        return response()->json($fr, 201);
    }

    public function update(Request $request, Friend $friend)
    {
        $user = $request->user();
        $data = $request->validate([
            'status' => ['required', Rule::in(['pending','accepted'])],
        ]);
        // Only the recipient can accept
        if ($friend->friend_id !== $user->id) return response()->json(['message' => 'Not allowed'], 403);
        $friend->status = $data['status'];
        $friend->save();
        return response()->json($friend);
    }

    public function destroy(Request $request, Friend $friend)
    {
        $user = $request->user();
        if ($friend->user_id !== $user->id && $friend->friend_id !== $user->id) {
            return response()->json(['message' => 'Not allowed'], 403);
        }
        $friend->delete();
        return response()->json(['ok' => true]);
    }

    // Username-based: send friend request by username
    public function requestByUsername(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'username' => ['required','string','max:255']
        ]);
        $other = User::where('username', $data['username'])->first();
        if (!$other) return response()->json(['message' => 'User not found'], 404);
        if ($other->id === $user->id) {
            Log::warning('Self friend request attempt (legacy username flow)', ['user_id' => $user->id]);
            return response()->json(['error' => 'Cannot send friend request to yourself', 'code' => 'SAME_USER_REQUEST'], 400);
        }

        // Block only if there is an accepted friendship or any pending request (legacy or new)
        $hasAccepted = Friend::where(function ($q) use ($user, $other) {
                $q->where('user_id', $user->id)->where('friend_id', $other->id);
            })->orWhere(function ($q) use ($user, $other) {
                $q->where('user_id', $other->id)->where('friend_id', $user->id);
            })->where('status','accepted')->exists();
        if ($hasAccepted) return response()->json(['message' => 'Already friends'], 409);
        $hasLegacyPending = Friend::where(function ($q) use ($user, $other) {
                $q->where('user_id', $user->id)->where('friend_id', $other->id);
            })->orWhere(function ($q) use ($user, $other) {
                $q->where('user_id', $other->id)->where('friend_id', $user->id);
            })->where('status','pending')->exists();
        $hasNewPending = Schema::hasTable('friend_requests') ? FriendRequest::where(function($q) use ($user,$other){
                $q->where('sender_id',$user->id)->where('receiver_id',$other->id);
            })->orWhere(function($q) use ($user,$other){
                $q->where('sender_id',$other->id)->where('receiver_id',$user->id);
            })->where('status','pending')->exists() : false;
        if ($hasLegacyPending || $hasNewPending) return response()->json(['message' => 'A friend request is already pending'], 409);

        // Prefer new flow: create FriendRequest only when table exists
        if (Schema::hasTable('friend_requests')) {
            $req = FriendRequest::create([
                'sender_id' => $user->id,
                'receiver_id' => $other->id,
                'status' => 'pending',
            ]);
            $req->load(['sender','receiver']);
            return response()->json($req, 201);
        } else {
            // Legacy fallback
            $fr = Friend::create([
                'user_id' => $user->id,
                'friend_id' => $other->id,
                'status' => 'pending',
            ]);
            return response()->json($fr, 201);
        }
    }

    // Username-based: accept a pending friend request from username
    public function acceptByUsername(Request $request, $username)
    {
        $user = $request->user();
        $other = User::where('username', $username)->first();
        if (!$other) return response()->json(['message' => 'User not found'], 404);

        $friend = Friend::where('user_id', $other->id)
            ->where('friend_id', $user->id)
            ->where('status', 'pending')
            ->first();
        if (!$friend) return response()->json(['message' => 'No pending request'], 404);

        $friend->status = 'accepted';
        $friend->save();
        return response()->json($friend);
    }

    // New friend_requests flow
    public function sendRequest(Request $request)
    {
        if (!Schema::hasTable('friend_requests')) {
            return response()->json(['message' => 'friend_requests table not available. Run migrations.'], 422);
        }
        $user = $request->user();
        $data = $request->validate([
            'receiver_username' => ['nullable','string','max:255'],
            'receiver_id' => ['nullable','integer', Rule::exists('users','id')],
            'username' => ['nullable','string','max:255'], // compatibility
        ]);
        $receiver = null;
        if (!empty($data['receiver_id'])) {
            $receiver = User::find($data['receiver_id']);
        }
        if (!$receiver && !empty($data['receiver_username'])) {
            $receiver = User::where('username', $data['receiver_username'])->first();
        }
        if (!$receiver && !empty($data['username'])) { // fallback
            $receiver = User::where('username', $data['username'])->first();
        }
        if (!$receiver) return response()->json(['message' => 'Receiver not found'], 404);
        if ($receiver->id === $user->id) {
            Log::warning('Self friend request attempt', ['user_id' => $user->id]);
            return response()->json(['error' => 'Cannot send friend request to yourself', 'code' => 'SAME_USER_REQUEST'], 400);
        }

        // prevent duplicates
        // Only block when there is accepted friendship or any pending request
        $hasAccepted = Friend::where(function ($q) use ($user, $receiver) {
                $q->where('user_id', $user->id)->where('friend_id', $receiver->id);
            })->orWhere(function ($q) use ($user, $receiver) {
                $q->where('user_id', $receiver->id)->where('friend_id', $user->id);
            })->where('status','accepted')->exists();
        if ($hasAccepted) return response()->json(['message' => 'Already friends'], 409);
        $hasLegacyPending = Friend::where(function ($q) use ($user, $receiver) {
                $q->where('user_id', $user->id)->where('friend_id', $receiver->id);
            })->orWhere(function ($q) use ($user, $receiver) {
                $q->where('user_id', $receiver->id)->where('friend_id', $user->id);
            })->where('status','pending')->exists();
        $hasNewPending = FriendRequest::where(function($q) use ($user,$receiver){
            $q->where('sender_id',$user->id)->where('receiver_id',$receiver->id);
        })->orWhere(function($q) use ($user,$receiver){
            $q->where('sender_id',$receiver->id)->where('receiver_id',$user->id);
        })->where('status','pending')->exists();
        if ($hasLegacyPending || $hasNewPending) return response()->json(['message' => 'A friend request is already pending'], 409);

        $fr = FriendRequest::create([
            'sender_id' => $user->id,
            'receiver_id' => $receiver->id,
            'status' => 'pending',
        ]);
        return response()->json([
            'success' => true,
            'message' => 'Friend request sent successfully',
            'data' => $fr,
            // legacy compatibility
            'request' => $fr,
        ], 201);
    }

    public function acceptRequest(Request $request)
    {
        if (!Schema::hasTable('friend_requests')) {
            return response()->json(['message' => 'friend_requests table not available. Run migrations.'], 422);
        }
        $user = $request->user();
        $data = $request->validate([
            'request_id' => ['nullable','integer'],
            'sender_id' => ['nullable','integer'],
        ]);
        // locate request either by request_id or by sender_id -> current user
        if (!empty($data['request_id'])) {
            $req = FriendRequest::findOrFail($data['request_id']);
        } else {
            if (empty($data['sender_id'])) return response()->json(['message' => 'request_id or sender_id is required'], 422);
            $req = FriendRequest::where('sender_id', $data['sender_id'])
                ->where('receiver_id', $user->id)
                ->where('status','pending')
                ->first();
            if (!$req) return response()->json(['message' => 'No pending request'], 404);
        }
        if ($req->receiver_id !== $user->id) return response()->json(['message' => 'Not allowed'], 403);
        // mark accepted then remove the pending row for a clean UI
        $req->status = 'accepted';
        $req->save();
        // Create friendship records in both directions, preventing duplicates
        $pair1 = Friend::where('user_id',$req->sender_id)->where('friend_id',$req->receiver_id)->first();
        if (!$pair1) { Friend::create(['user_id'=>$req->sender_id,'friend_id'=>$req->receiver_id,'status'=>'accepted']); }
        else { if ($pair1->status !== 'accepted') { $pair1->status = 'accepted'; $pair1->save(); } }
        $pair2 = Friend::where('user_id',$req->receiver_id)->where('friend_id',$req->sender_id)->first();
        if (!$pair2) { Friend::create(['user_id'=>$req->receiver_id,'friend_id'=>$req->sender_id,'status'=>'accepted']); }
        else { if ($pair2->status !== 'accepted') { $pair2->status = 'accepted'; $pair2->save(); } }
        // cleanup: remove any legacy pending rows for this pair
        Friend::where(function($q) use ($req){
            $q->where('user_id',$req->sender_id)->where('friend_id',$req->receiver_id);
        })->orWhere(function($q) use ($req){
            $q->where('user_id',$req->receiver_id)->where('friend_id',$req->sender_id);
        })->where('status','pending')->delete();
        // remove the request row to avoid reappearing
        $req->delete();
        // return updated friends for current user
        $friends = Friend::where(function ($q) use ($user) {
                $q->where('user_id', $user->id)
                  ->orWhere('friend_id', $user->id);
            })
            ->with(['user','friend'])
            ->get();
        return response()->json(['success'=>true,'friends'=>$friends]);
    }

    // List accepted friends for a specific user ID
    public function friendsOf(Request $request, $userId)
    {
        $auth = $request->user();
        // For now, allow fetching any user's friends list; tighten if needed
        $target = User::find($userId);
        if (!$target) return response()->json(['message'=>'User not found'], 404);
        $friends = Friend::where(function ($q) use ($target) {
                $q->where('user_id', $target->id)
                  ->orWhere('friend_id', $target->id);
            })
            ->where('status','accepted')
            ->with(['user','friend'])
            ->orderByDesc('created_at')
            ->get();
        return response()->json(['success'=>true,'friends'=>$friends]);
    }

    public function rejectRequest(Request $request)
    {
        if (!Schema::hasTable('friend_requests')) {
            return response()->json(['message' => 'friend_requests table not available. Run migrations.'], 422);
        }
        $user = $request->user();
        $data = $request->validate([
            'request_id' => ['nullable','integer'],
            'sender_id' => ['nullable','integer'],
        ]);
        if (!empty($data['request_id'])) {
            $req = FriendRequest::findOrFail($data['request_id']);
        } else {
            if (empty($data['sender_id'])) return response()->json(['message' => 'request_id or sender_id is required'], 422);
            $req = FriendRequest::where('sender_id', $data['sender_id'])
                ->where('receiver_id', $user->id)
                ->where('status','pending')
                ->first();
            if (!$req) return response()->json(['message' => 'No pending request'], 404);
        }
        if ($req->receiver_id !== $user->id) return response()->json(['message' => 'Not allowed'], 403);
        // delete request so it never reappears
        $senderId = $req->sender_id; $receiverId = $req->receiver_id;
        $req->delete();
        // cleanup legacy pending rows (old flow)
        Friend::where(function($q) use ($senderId,$receiverId){
            $q->where('user_id',$senderId)->where('friend_id',$receiverId);
        })->orWhere(function($q) use ($senderId,$receiverId){
            $q->where('user_id',$receiverId)->where('friend_id',$senderId);
        })->where('status','pending')->delete();
        return response()->json([
            'success' => true,
            'message' => 'Friend request rejected',
            'ok' => true,
        ]);
    }

    public function getRequests(Request $request)
    {
        $user = $request->user();
        $incomingReqs = collect();
        $outgoingReqs = collect();
        if (Schema::hasTable('friend_requests')) {
            $incomingReqs = FriendRequest::where('receiver_id',$user->id)->where('status','pending')
                ->with(['sender'])
                ->orderByDesc('created_at')->get()
                ->map(function($r){
                    return [
                        'id' => $r->id,
                        'sender_id' => $r->sender_id,
                        'receiver_id' => $r->receiver_id,
                        'sender' => [ 'username' => optional($r->sender)->username, 'profile_image' => optional($r->sender)->profile_image ],
                        'status' => $r->status,
                        'created_at' => $r->created_at,
                        'source' => 'fr',
                    ];
                });
            $outgoingReqs = FriendRequest::where('sender_id',$user->id)->where('status','pending')
                ->with(['receiver'])
                ->orderByDesc('created_at')->get()
                ->map(function($r){
                    return [
                        'id' => $r->id,
                        'sender_id' => $r->sender_id,
                        'receiver_id' => $r->receiver_id,
                        'receiver' => [ 'username' => optional($r->receiver)->username, 'profile_image' => optional($r->receiver)->profile_image ],
                        'status' => $r->status,
                        'created_at' => $r->created_at,
                        'source' => 'fr',
                    ];
                });
        }
        // Include legacy pending Friend rows as requests as well
        $legacyIncoming = Friend::where('friend_id',$user->id)->where('status','pending')
            ->with(['user'])
            ->get()
            ->map(function($f){
                return [
                    'id' => $f->id,
                    'sender_id' => $f->user_id,
                    'receiver_id' => $f->friend_id,
                    'sender' => [ 'username' => optional($f->user)->username, 'profile_image' => optional($f->user)->profile_image ],
                    'status' => 'pending',
                    'created_at' => $f->created_at,
                    'source' => 'legacy',
                    'friend_row_id' => $f->id,
                ];
            });
        $legacyOutgoing = Friend::where('user_id',$user->id)->where('status','pending')
            ->with(['friend'])
            ->get()
            ->map(function($f){
                return [
                    'id' => $f->id,
                    'sender_id' => $f->user_id,
                    'receiver_id' => $f->friend_id,
                    'receiver' => [ 'username' => optional($f->friend)->username, 'profile_image' => optional($f->friend)->profile_image ],
                    'status' => 'pending',
                    'created_at' => $f->created_at,
                    'source' => 'legacy',
                    'friend_row_id' => $f->id,
                ];
            });
        // Merge and de-duplicate by sender_id->receiver_id key
        $incomingMerged = $incomingReqs->merge($legacyIncoming);
        $outgoingMerged = $outgoingReqs->merge($legacyOutgoing);
        $incoming = [];
        $seenIn = [];
        foreach ($incomingMerged as $row) {
            $key = ($row['sender_id'] ?? null).'->'.($row['receiver_id'] ?? null);
            if ($key && !isset($seenIn[$key])) { $incoming[] = $row; $seenIn[$key] = true; }
        }
        $outgoing = [];
        $seenOut = [];
        foreach ($outgoingMerged as $row) {
            $key = ($row['sender_id'] ?? null).'->'.($row['receiver_id'] ?? null);
            if ($key && !isset($seenOut[$key])) { $outgoing[] = $row; $seenOut[$key] = true; }
        }
        $friends = Friend::where(function ($q) use ($user) {
                $q->where('user_id', $user->id)
                  ->orWhere('friend_id', $user->id);
            })
            ->with(['user','friend'])
            ->get();
        return response()->json([
            'success' => true,
            'message' => 'Fetched friend requests',
            'data' => [
                'incoming_requests' => $incoming,
                'outgoing_requests' => $outgoing,
                'friends' => $friends,
            ],
            // legacy compatibility (flattened keys)
            'incoming_requests' => $incoming,
            'outgoing_requests' => $outgoing,
            'friends' => $friends,
        ]);
    }

    // Search users by username (prefix or contains), excluding self
    public function search(Request $request)
    {
        $user = $request->user();
        $q = trim((string)$request->query('username', ''));
        if ($q === '') return response()->json(['success'=>true,'data'=>[]]);
        $rows = User::where('username', 'like', "%".$q."%")
            ->where('id','<>',$user->id)
            ->orderBy('username')
            ->limit(10)
            ->get(['id','username','role','bio','status','profile_image','created_at']);
        return response()->json(['success'=>true,'data'=>$rows]);
    }

    // Remove friend by other user's id (bidirectional cleanup)
    public function remove(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'friend_id' => ['required','integer', Rule::exists('users','id')],
        ]);
        $affected = Friend::where(function($q) use ($user,$data){
            $q->where('user_id',$user->id)->where('friend_id',$data['friend_id']);
        })->orWhere(function($q) use ($user,$data){
            $q->where('user_id',$data['friend_id'])->where('friend_id',$user->id);
        })->delete();
        if ($affected === 0) {
            return response()->json(['error' => 'Friendship not found'], 404);
        }
        return response()->json(['success'=>true,'message'=>'Friend removed successfully']);
    }

    // Remove friend by other user's id passed as path param
    public function removeByUserId(Request $request, $id)
    {
        $user = $request->user();
        $otherId = (int)$id;
        if ($otherId <= 0) return response()->json(['error'=>'Invalid id'], 422);
        $affected = Friend::where(function($q) use ($user,$otherId){
            $q->where('user_id',$user->id)->where('friend_id',$otherId);
        })->orWhere(function($q) use ($user,$otherId){
            $q->where('user_id',$otherId)->where('friend_id',$user->id);
        })->delete();
        if ($affected === 0) {
            return response()->json(['error' => 'Friendship not found'], 404);
        }
        return response()->json(['success'=>true,'message'=>'Friend removed successfully']);
    }
}
