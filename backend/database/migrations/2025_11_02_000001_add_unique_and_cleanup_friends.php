<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('friends')) {
            // 1) Cleanup bad data first to allow unique index
            // Remove self-friend rows
            try { DB::statement('DELETE FROM friends WHERE user_id = friend_id'); } catch (\Throwable $e) {}

            // Remove exact duplicate rows keeping the lowest id (MySQL syntax; ignore on SQLite)
            try { DB::statement('DELETE f1 FROM friends f1 JOIN friends f2 ON f1.user_id = f2.user_id AND f1.friend_id = f2.friend_id AND f1.id > f2.id'); } catch (\Throwable $e) {}

            // 2) Add unique index on (user_id, friend_id)
            try {
                Schema::table('friends', function (Blueprint $table) {
                    $table->unique(['user_id','friend_id'], 'friends_user_friend_unique');
                });
            } catch (\Throwable $e) {
                // index may already exist; ignore
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('friends')) {
            try {
                Schema::table('friends', function (Blueprint $table) {
                    $table->dropUnique('friends_user_friend_unique');
                });
            } catch (\Throwable $e) {}
        }
    }
};

