<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('quizzes', function (Blueprint $table) {
            if (!Schema::hasColumn('quizzes', 'is_published')) {
                $table->boolean('is_published')->default(false)->after('visibility');
            }
            if (!Schema::hasColumn('quizzes', 'is_repeatable')) {
                $table->boolean('is_repeatable')->default(true)->after('is_published');
            }
            if (!Schema::hasColumn('quizzes', 'is_shared')) {
                $table->boolean('is_shared')->default(false)->after('is_repeatable');
            }
            if (!Schema::hasColumn('quizzes', 'is_available')) {
                $table->boolean('is_available')->default(true)->after('is_shared');
            }
            if (Schema::hasColumn('quizzes', 'course_id')) {
                $table->foreignId('course_id')->nullable()->change();
            }
        });
    }

    public function down(): void
    {
        Schema::table('quizzes', function (Blueprint $table) {
            if (Schema::hasColumn('quizzes', 'is_available')) {
                $table->dropColumn('is_available');
            }
            if (Schema::hasColumn('quizzes', 'is_shared')) {
                $table->dropColumn('is_shared');
            }
            if (Schema::hasColumn('quizzes', 'is_repeatable')) {
                $table->dropColumn('is_repeatable');
            }
            if (Schema::hasColumn('quizzes', 'is_published')) {
                $table->dropColumn('is_published');
            }
            if (Schema::hasColumn('quizzes', 'course_id')) {
                $table->foreignId('course_id')->nullable(false)->change();
            }
        });
    }
};
