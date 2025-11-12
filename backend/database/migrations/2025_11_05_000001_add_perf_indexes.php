<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // enrollments indexes
        if (Schema::hasTable('enrollments')) {
            Schema::table('enrollments', function (Blueprint $table) {
                if (!self::indexExists('enrollments', 'enrollments_course_user')) {
                    $table->index(['course_id','user_id'], 'enrollments_course_user');
                }
                if (!self::indexExists('enrollments', 'enrollments_user_course')) {
                    $table->index(['user_id','course_id'], 'enrollments_user_course');
                }
            });
        }

        // announcements indexes
        if (Schema::hasTable('announcements')) {
            Schema::table('announcements', function (Blueprint $table) {
                if (!self::indexExists('announcements', 'announcements_course_created')) {
                    $table->index(['course_id','created_at'], 'announcements_course_created');
                }
            });
        }

        // courses indexes
        if (Schema::hasTable('courses')) {
            Schema::table('courses', function (Blueprint $table) {
                if (Schema::hasColumn('courses','teacher_id') && !self::indexExists('courses', 'courses_teacher_created')) {
                    $table->index(['teacher_id','created_at'], 'courses_teacher_created');
                }
                if (Schema::hasColumn('courses','is_public') && !self::indexExists('courses', 'courses_public_created')) {
                    $table->index(['is_public','created_at'], 'courses_public_created');
                }
                if (Schema::hasColumn('courses','course_code') && !self::indexExists('courses', 'courses_course_code_unique')) {
                    $table->unique('course_code', 'courses_course_code_unique');
                }
            });
        }

        // friends indexes (if table exists)
        if (Schema::hasTable('friends')) {
            Schema::table('friends', function (Blueprint $table) {
                if (!self::indexExists('friends', 'friends_user_friend')) {
                    $table->index(['user_id','friend_id'], 'friends_user_friend');
                }
                if (!self::indexExists('friends', 'friends_friend_user')) {
                    $table->index(['friend_id','user_id'], 'friends_friend_user');
                }
            });
        }

        // users indexes
        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                if (Schema::hasColumn('users','username') && !self::indexExists('users', 'users_username_unique')) {
                    $table->unique('username', 'users_username_unique');
                }
                if (Schema::hasColumn('users','email') && !self::indexExists('users', 'users_email_unique')) {
                    $table->unique('email', 'users_email_unique');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('enrollments')) {
            Schema::table('enrollments', function (Blueprint $table) {
                self::dropIndexIfExists('enrollments', 'enrollments_course_user');
                self::dropIndexIfExists('enrollments', 'enrollments_user_course');
            });
        }
        if (Schema::hasTable('announcements')) {
            Schema::table('announcements', function (Blueprint $table) {
                self::dropIndexIfExists('announcements', 'announcements_course_created');
            });
        }
        if (Schema::hasTable('courses')) {
            Schema::table('courses', function (Blueprint $table) {
                self::dropIndexIfExists('courses', 'courses_teacher_created');
                self::dropIndexIfExists('courses', 'courses_public_created');
                self::dropIndexIfExists('courses', 'courses_course_code_unique');
            });
        }
        if (Schema::hasTable('friends')) {
            Schema::table('friends', function (Blueprint $table) {
                self::dropIndexIfExists('friends', 'friends_user_friend');
                self::dropIndexIfExists('friends', 'friends_friend_user');
            });
        }
        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                self::dropIndexIfExists('users', 'users_username_unique');
                self::dropIndexIfExists('users', 'users_email_unique');
            });
        }
    }

    private static function indexExists(string $table, string $index): bool
    {
        try {
            $db = DB::getDatabaseName();
            $row = DB::selectOne(
                'SELECT COUNT(1) AS c FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1',
                [$db, $table, $index]
            );
            $count = (int)($row->c ?? 0);
            return $count > 0;
        } catch (\Throwable $e) {
            return false;
        }
    }

    private static function dropIndexIfExists(string $table, string $index): void
    {
        try {
            if (self::indexExists($table, $index)) {
                Schema::table($table, function (Blueprint $t) use ($index) {
                    // Try both dropUnique and dropIndex; one will succeed depending on type
                    try { $t->dropUnique($index); } catch (\Throwable $__) {}
                    try { $t->dropIndex($index); } catch (\Throwable $__) {}
                });
            }
        } catch (\Throwable $e) {}
    }
};
