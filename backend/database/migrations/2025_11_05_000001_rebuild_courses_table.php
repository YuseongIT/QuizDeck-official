<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('courses');
        Schema::create('courses', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('name');
            $table->text('description');
            $table->boolean('is_public')->default(true);
            $table->string('course_code')->default('');
            $table->unsignedBigInteger('teacher_id');
            $table->string('teacher_email');
            $table->string('image_url')->default('');
            $table->timestamps();
            $table->index(['teacher_id']);
            $table->index(['is_public']);
        });
        Schema::enableForeignKeyConstraints();
    }

    public function down(): void
    {
        Schema::dropIfExists('courses');
    }
};
