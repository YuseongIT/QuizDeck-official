<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('quiz_attempts')) return;
        Schema::create('quiz_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_id')->constrained('quizzes')->onDelete('cascade');
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            $table->unsignedInteger('score')->nullable();
            $table->unsignedInteger('total_items')->default(0);
            $table->boolean('is_submitted')->default(false);
            $table->json('in_progress_data')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('quiz_attempts')) {
            Schema::dropIfExists('quiz_attempts');
        }
    }
};
