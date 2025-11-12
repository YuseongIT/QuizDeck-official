<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('quiz_choices')) return;
        Schema::create('quiz_choices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->constrained('quiz_items')->onDelete('cascade');
            $table->string('choice_text');
            $table->boolean('is_correct')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('quiz_choices')) {
            Schema::dropIfExists('quiz_choices');
        }
    }
};
