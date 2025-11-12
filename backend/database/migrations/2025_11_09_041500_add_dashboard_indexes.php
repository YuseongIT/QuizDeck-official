<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // enrollments
        if (Schema::hasTable('enrollments')) {
            $existing = array_map(fn($r)=>$r->Key_name, DB::select('SHOW INDEX FROM `enrollments`'));
            Schema::table('enrollments', function (Blueprint $table) use ($existing) {
                if (!in_array('enrollments_user_id_idx', $existing)) { $table->index('user_id', 'enrollments_user_id_idx'); }
                if (!in_array('enrollments_course_id_idx', $existing)) { $table->index('course_id', 'enrollments_course_id_idx'); }
                if (!in_array('enrollments_user_course_idx', $existing)) { $table->index(['user_id','course_id'], 'enrollments_user_course_idx'); }
                if (!in_array('enrollments_course_user_idx', $existing)) { $table->index(['course_id','user_id'], 'enrollments_course_user_idx'); }
            });
        }

        // courses
        if (Schema::hasTable('courses')) {
            $existing = array_map(fn($r)=>$r->Key_name, DB::select('SHOW INDEX FROM `courses`'));
            Schema::table('courses', function (Blueprint $table) use ($existing) {
                if (!in_array('courses_teacher_id_idx', $existing)) { $table->index('teacher_id', 'courses_teacher_id_idx'); }
                if (!in_array('courses_created_at_idx', $existing)) { $table->index('created_at', 'courses_created_at_idx'); }
            });
        }

        // quizzes
        if (Schema::hasTable('quizzes')) {
            $existing = array_map(fn($r)=>$r->Key_name, DB::select('SHOW INDEX FROM `quizzes`'));
            Schema::table('quizzes', function (Blueprint $table) use ($existing) {
                if (!in_array('quizzes_course_id_idx', $existing)) { $table->index('course_id', 'quizzes_course_id_idx'); }
                if (!in_array('quizzes_creator_id_idx', $existing)) { $table->index('creator_id', 'quizzes_creator_id_idx'); }
                if (Schema::hasColumn('quizzes','is_published') && !in_array('quizzes_is_published_idx', $existing)) { $table->index('is_published', 'quizzes_is_published_idx'); }
                if (Schema::hasColumn('quizzes','is_available') && !in_array('quizzes_is_available_idx', $existing)) { $table->index('is_available', 'quizzes_is_available_idx'); }
                if (!in_array('quizzes_created_at_idx', $existing)) { $table->index('created_at', 'quizzes_created_at_idx'); }
                if (!in_array('quizzes_course_created_idx', $existing)) { $table->index(['course_id','created_at'], 'quizzes_course_created_idx'); }
            });
        }

        // announcements
        if (Schema::hasTable('announcements')) {
            $existing = array_map(fn($r)=>$r->Key_name, DB::select('SHOW INDEX FROM `announcements`'));
            Schema::table('announcements', function (Blueprint $table) use ($existing) {
                if (!in_array('ann_course_id_idx', $existing)) { $table->index('course_id', 'ann_course_id_idx'); }
                if (Schema::hasColumn('announcements','teacher_id') && !in_array('ann_teacher_id_idx', $existing)) { $table->index('teacher_id', 'ann_teacher_id_idx'); }
                if (!in_array('ann_created_at_idx', $existing)) { $table->index('created_at', 'ann_created_at_idx'); }
            });
        }

        // activity logs (table name may vary: activity_logs)
        if (Schema::hasTable('activity_logs')) {
            $existing = array_map(fn($r)=>$r->Key_name, DB::select('SHOW INDEX FROM `activity_logs`'));
            Schema::table('activity_logs', function (Blueprint $table) use ($existing) {
                if (!in_array('act_user_id_idx', $existing)) { $table->index('user_id', 'act_user_id_idx'); }
                if (Schema::hasColumn('activity_logs','completed_at') && !in_array('act_completed_at_idx', $existing)) { $table->index('completed_at', 'act_completed_at_idx'); }
            });
        }

        // friends
        if (Schema::hasTable('friends')) {
            $existing = array_map(fn($r)=>$r->Key_name, DB::select('SHOW INDEX FROM `friends`'));
            Schema::table('friends', function (Blueprint $table) use ($existing) {
                if (!in_array('friends_user_id_idx', $existing)) { $table->index('user_id', 'friends_user_id_idx'); }
                if (!in_array('friends_friend_id_idx', $existing)) { $table->index('friend_id', 'friends_friend_id_idx'); }
                if (Schema::hasColumn('friends','status') && !in_array('friends_status_idx', $existing)) { $table->index('status', 'friends_status_idx'); }
                if (!in_array('friends_user_friend_idx', $existing)) { $table->index(['user_id','friend_id'], 'friends_user_friend_idx'); }
            });
        }
    }

    public function down(): void
    {
        // enrollments
        if (Schema::hasTable('enrollments')) {
            $existing = array_map(fn($r)=>$r->Key_name, DB::select('SHOW INDEX FROM `enrollments`'));
            Schema::table('enrollments', function (Blueprint $table) use ($existing) {
                if (in_array('enrollments_user_id_idx', $existing)) { $table->dropIndex('enrollments_user_id_idx'); }
                if (in_array('enrollments_course_id_idx', $existing)) { $table->dropIndex('enrollments_course_id_idx'); }
                if (in_array('enrollments_user_course_idx', $existing)) { $table->dropIndex('enrollments_user_course_idx'); }
                if (in_array('enrollments_course_user_idx', $existing)) { $table->dropIndex('enrollments_course_user_idx'); }
            });
        }

        // courses
        if (Schema::hasTable('courses')) {
            $existing = array_map(fn($r)=>$r->Key_name, DB::select('SHOW INDEX FROM `courses`'));
            Schema::table('courses', function (Blueprint $table) use ($existing) {
                if (in_array('courses_teacher_id_idx', $existing)) { $table->dropIndex('courses_teacher_id_idx'); }
                if (in_array('courses_created_at_idx', $existing)) { $table->dropIndex('courses_created_at_idx'); }
            });
        }

        // quizzes
        if (Schema::hasTable('quizzes')) {
            $existing = array_map(fn($r)=>$r->Key_name, DB::select('SHOW INDEX FROM `quizzes`'));
            Schema::table('quizzes', function (Blueprint $table) use ($existing) {
                if (in_array('quizzes_course_id_idx', $existing)) { $table->dropIndex('quizzes_course_id_idx'); }
                if (in_array('quizzes_creator_id_idx', $existing)) { $table->dropIndex('quizzes_creator_id_idx'); }
                if (in_array('quizzes_is_published_idx', $existing)) { $table->dropIndex('quizzes_is_published_idx'); }
                if (in_array('quizzes_is_available_idx', $existing)) { $table->dropIndex('quizzes_is_available_idx'); }
                if (in_array('quizzes_created_at_idx', $existing)) { $table->dropIndex('quizzes_created_at_idx'); }
                if (in_array('quizzes_course_created_idx', $existing)) { $table->dropIndex('quizzes_course_created_idx'); }
            });
        }

        // announcements
        if (Schema::hasTable('announcements')) {
            $existing = array_map(fn($r)=>$r->Key_name, DB::select('SHOW INDEX FROM `announcements`'));
            Schema::table('announcements', function (Blueprint $table) use ($existing) {
                if (in_array('ann_course_id_idx', $existing)) { $table->dropIndex('ann_course_id_idx'); }
                if (in_array('ann_teacher_id_idx', $existing)) { $table->dropIndex('ann_teacher_id_idx'); }
                if (in_array('ann_created_at_idx', $existing)) { $table->dropIndex('ann_created_at_idx'); }
            });
        }

        // activity_logs
        if (Schema::hasTable('activity_logs')) {
            $existing = array_map(fn($r)=>$r->Key_name, DB::select('SHOW INDEX FROM `activity_logs`'));
            Schema::table('activity_logs', function (Blueprint $table) use ($existing) {
                if (in_array('act_user_id_idx', $existing)) { $table->dropIndex('act_user_id_idx'); }
                if (in_array('act_completed_at_idx', $existing)) { $table->dropIndex('act_completed_at_idx'); }
            });
        }

        // friends
        if (Schema::hasTable('friends')) {
            $existing = array_map(fn($r)=>$r->Key_name, DB::select('SHOW INDEX FROM `friends`'));
            Schema::table('friends', function (Blueprint $table) use ($existing) {
                if (in_array('friends_user_id_idx', $existing)) { $table->dropIndex('friends_user_id_idx'); }
                if (in_array('friends_friend_id_idx', $existing)) { $table->dropIndex('friends_friend_id_idx'); }
                if (in_array('friends_status_idx', $existing)) { $table->dropIndex('friends_status_idx'); }
                if (in_array('friends_user_friend_idx', $existing)) { $table->dropIndex('friends_user_friend_idx'); }
            });
        }
    }
};
