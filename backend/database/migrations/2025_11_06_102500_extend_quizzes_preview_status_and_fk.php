<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('quizzes', function (Blueprint $table) {
            if (!Schema::hasColumn('quizzes', 'preview_image_url')) {
                $table->string('preview_image_url')->nullable()->after('description');
            }
            if (!Schema::hasColumn('quizzes', 'status')) {
                $table->string('status')->default('draft')->after('preview_image_url'); // draft|published
            }
            if (!Schema::hasColumn('quizzes', 'creator_role')) {
                $table->string('creator_role', 32)->nullable()->after('creator_id');
            }
        });

        // Ensure course_id is nullable and cascades on course deletion
        // Drop existing foreign key if present (name may vary); ignore if it doesn't exist
        try { \DB::statement('ALTER TABLE `quizzes` DROP FOREIGN KEY `quizzes_course_id_foreign`'); } catch (\Throwable $e) {}
        try { \DB::statement('ALTER TABLE `quizzes` DROP FOREIGN KEY `quizzes_course_id_foreign_1`'); } catch (\Throwable $e) {}
        try { \DB::statement('ALTER TABLE `quizzes` DROP FOREIGN KEY `fk_quizzes_course_id`'); } catch (\Throwable $e) {}
        Schema::table('quizzes', function (Blueprint $table) {
            $table->unsignedBigInteger('course_id')->nullable()->change();
            $table->foreign('course_id')->references('id')->on('courses')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::table('quizzes', function (Blueprint $table) {
            if (Schema::hasColumn('quizzes', 'preview_image_url')) $table->dropColumn('preview_image_url');
            if (Schema::hasColumn('quizzes', 'status')) $table->dropColumn('status');
            if (Schema::hasColumn('quizzes', 'creator_role')) $table->dropColumn('creator_role');
        });
        // Do not revert FK behavior in down for safety.
    }
};
