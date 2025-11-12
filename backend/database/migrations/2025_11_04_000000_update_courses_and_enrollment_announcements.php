<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration {
    public function up(): void
    {
        // Update courses table to match spec
        if (Schema::hasTable('courses')) {
            Schema::table('courses', function (Blueprint $table) {
                if (!Schema::hasColumn('courses', 'name')) {
                    $table->string('name')->nullable()->after('id');
                }
                if (!Schema::hasColumn('courses', 'description')) {
                    $table->text('description')->nullable()->after('name');
                }
                if (!Schema::hasColumn('courses', 'course_id')) {
                    $table->string('course_id')->unique()->nullable()->after('course_code');
                }
                if (!Schema::hasColumn('courses', 'is_public')) {
                    $table->boolean('is_public')->default(false)->after('course_id');
                }
                if (!Schema::hasColumn('courses', 'image_url')) {
                    $table->string('image_url')->nullable()->after('is_public');
                }
            });
            // Make course_code nullable while preserving unique index (MySQL)
            try {
                if (Schema::hasColumn('courses', 'course_code')) {
                    // Drop existing unique index if necessary; recreate as unique nullable
                    // Try altering column to NULL
                    DB::statement("ALTER TABLE courses MODIFY course_code VARCHAR(255) NULL");
                }
            } catch (\Throwable $e) {
                // ignore if not supported
            }
            // Backfill name from existing column course_name if present
            if (Schema::hasColumn('courses','course_name') && Schema::hasColumn('courses','name')) {
                DB::table('courses')->whereNull('name')->update(['name' => DB::raw('course_name')]);
            }
            // Backfill course_id with UUIDs where null
            if (Schema::hasColumn('courses','course_id')) {
                $rows = DB::table('courses')->whereNull('course_id')->get(['id']);
                foreach ($rows as $r) {
                    DB::table('courses')->where('id',$r->id)->update(['course_id' => (string) Str::uuid()]);
                }
            }
        }

        // Create course_student pivot
        if (!Schema::hasTable('course_student')) {
            Schema::create('course_student', function (Blueprint $table) {
                $table->id();
                $table->foreignId('course_id')->constrained('courses')->onDelete('cascade');
                $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
                $table->timestamp('enrolled_at')->useCurrent();
                $table->timestamps();
                $table->unique(['course_id','user_id']);
            });
        }

        // Create announcements
        if (!Schema::hasTable('announcements')) {
            Schema::create('announcements', function (Blueprint $table) {
                $table->id();
                $table->foreignId('course_id')->constrained('courses')->onDelete('cascade');
                $table->foreignId('teacher_id')->constrained('users')->onDelete('cascade');
                $table->string('title');
                $table->text('message');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        // Drop created tables (not reverting column changes to avoid data loss)
        if (Schema::hasTable('announcements')) Schema::dropIfExists('announcements');
        if (Schema::hasTable('course_student')) Schema::dropIfExists('course_student');
        // Leave courses extra columns in place to avoid destructive rollback
    }
};
