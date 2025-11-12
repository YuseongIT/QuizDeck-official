<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('announcement_dismissals')) {
            Schema::create('announcement_dismissals', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->unsignedBigInteger('announcement_id');
                $table->timestamps();
                $table->unique(['user_id','announcement_id']);
                $table->index(['user_id']);
                $table->index(['announcement_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('announcement_dismissals');
    }
};
