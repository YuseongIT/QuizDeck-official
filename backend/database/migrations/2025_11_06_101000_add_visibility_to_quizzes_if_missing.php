<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('quizzes', 'visibility')) {
            Schema::table('quizzes', function (Blueprint $table) {
                $table->enum('visibility', ['public','friends'])->default('public')->after('creator_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('quizzes', 'visibility')) {
            Schema::table('quizzes', function (Blueprint $table) {
                $table->dropColumn('visibility');
            });
        }
    }
};
