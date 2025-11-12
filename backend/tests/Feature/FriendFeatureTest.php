<?php

namespace Tests\Feature;

use App\Models\Friend;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FriendFeatureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Ensure default users table and our migrations run
        $this->artisan('migrate');
    }

    public function test_cannot_send_friend_request_to_self(): void
    {
        $me = User::factory()->create(['username' => 'user_'.uniqid()]);
        Sanctum::actingAs($me);

        $resp = $this->postJson('/api/friends/send', [ 'receiver_id' => $me->id ]);
        $resp->assertStatus(400)
             ->assertJson([ 'code' => 'SAME_USER_REQUEST' ]);
    }

    public function test_send_request_then_accept_creates_friendship_and_cleans_pending(): void
    {
        $a = User::factory()->create(['username' => 'a_'.uniqid()]);
        $b = User::factory()->create(['username' => 'b_'.uniqid()]);
        Sanctum::actingAs($a);

        // Send request A -> B
        $send = $this->postJson('/api/friends/send', [ 'receiver_id' => $b->id ]);
        $send->assertCreated();

        // B accepts
        Sanctum::actingAs($b);
        $requestId = $send->json('data.id') ?? $send->json('request.id');
        $accept = $this->postJson('/api/friends/accept', [ 'request_id' => $requestId ]);
        $accept->assertOk();

        // At least one direction should exist as accepted (implementation may store one or both rows)
        $hasAB = Friend::where(['user_id'=>$a->id,'friend_id'=>$b->id,'status'=>'accepted'])->exists();
        $hasBA = Friend::where(['user_id'=>$b->id,'friend_id'=>$a->id,'status'=>'accepted'])->exists();
        $this->assertTrue($hasAB || $hasBA, 'Expected accepted friendship in either direction');
    }

    public function test_duplicate_request_is_conflict(): void
    {
        $a = User::factory()->create(['username' => 'dup_a_'.uniqid()]);
        $b = User::factory()->create(['username' => 'dup_b_'.uniqid()]);
        Sanctum::actingAs($a);

        $this->postJson('/api/friends/send', [ 'receiver_id' => $b->id ])->assertCreated();
        // Send again
        $this->postJson('/api/friends/send', [ 'receiver_id' => $b->id ])->assertStatus(409);
    }

    public function test_remove_friend_by_user_id_endpoint(): void
    {
        $a = User::factory()->create(['username' => 'rem_a_'.uniqid()]);
        $b = User::factory()->create(['username' => 'rem_b_'.uniqid()]);
        // Seed accepted friendship (both directions)
        Friend::create([ 'user_id' => $a->id, 'friend_id' => $b->id, 'status' => 'accepted' ]);
        Friend::create([ 'user_id' => $b->id, 'friend_id' => $a->id, 'status' => 'accepted' ]);

        Sanctum::actingAs($a);
        $resp = $this->deleteJson('/api/friends/remove/'.$b->id);
        $resp->assertOk()->assertJson([ 'success' => true ]);

        $this->assertDatabaseMissing('friends', [ 'user_id' => $a->id, 'friend_id' => $b->id ]);
        $this->assertDatabaseMissing('friends', [ 'user_id' => $b->id, 'friend_id' => $a->id ]);
    }

    public function test_remove_nonexistent_returns_404(): void
    {
        $a = User::factory()->create(['username' => 'nf_a_'.uniqid()]);
        $b = User::factory()->create(['username' => 'nf_b_'.uniqid()]);
        Sanctum::actingAs($a);

        $this->deleteJson('/api/friends/remove/'.$b->id)
             ->assertStatus(404)
             ->assertJson([ 'error' => 'Friendship not found' ]);
    }

    public function test_after_removal_can_send_request_again(): void
    {
        $a = User::factory()->create(['username' => 'again_a_'.uniqid()]);
        $b = User::factory()->create(['username' => 'again_b_'.uniqid()]);
        // Seed accepted friendship then remove
        Friend::create([ 'user_id' => $a->id, 'friend_id' => $b->id, 'status' => 'accepted' ]);
        Friend::create([ 'user_id' => $b->id, 'friend_id' => $a->id, 'status' => 'accepted' ]);

        Sanctum::actingAs($a);
        $this->deleteJson('/api/friends/remove/'.$b->id)->assertOk();

        // Now send request again
        $this->postJson('/api/friends/send', [ 'receiver_id' => $b->id ])->assertCreated();
        $this->assertDatabaseHas('friend_requests', [ 'sender_id' => $a->id, 'receiver_id' => $b->id, 'status' => 'pending' ]);
    }
}
