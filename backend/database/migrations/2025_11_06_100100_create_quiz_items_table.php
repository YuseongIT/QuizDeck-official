<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('quiz_items')) return; // already present in DB
        Schema::create('quiz_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_id')->constrained('quizzes')->onDelete('cascade');
            $table->enum('type', ['multiple_choice','identification']);
            $table->text('question');
            $table->text('correct_answer')->nullable();
            $table->string('image_path')->nullable();
            $table->unsignedInteger('order_index')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('quiz_items')) {
            Schema::dropIfExists('quiz_items');
        }
    }
};
