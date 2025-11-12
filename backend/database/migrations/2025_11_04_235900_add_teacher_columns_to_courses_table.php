<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            if (!Schema::hasColumn('courses', 'teacher_email')) {
                $table->string('teacher_email')->nullable()->index();
            }
            if (!Schema::hasColumn('courses', 'teacher_id')) {
                $table->unsignedBigInteger('teacher_id')->nullable()->index();
                $table->foreign('teacher_id')->references('id')->on('users')->onDelete('set null');
            }
        });
    }

    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            if (Schema::hasColumn('courses', 'teacher_id')) {
                // drop FK if exists
                try { $table->dropForeign(['teacher_id']); } catch (\Throwable $e) {}
                try { $table->dropIndex(['teacher_id']); } catch (\Throwable $e) {}
                $table->dropColumn('teacher_id');
            }
            if (Schema::hasColumn('courses', 'teacher_email')) {
                try { $table->dropIndex(['teacher_email']); } catch (\Throwable $e) {}
                $table->dropColumn('teacher_email');
            }
        });
    }
};
