<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('quiz_items', function (Blueprint $table) {
            if (!Schema::hasColumn('quiz_items', 'meta')) {
                $table->json('meta')->nullable()->after('order_index');
            }
        });
    }

    public function down(): void
    {
        Schema::table('quiz_items', function (Blueprint $table) {
            if (Schema::hasColumn('quiz_items', 'meta')) {
                $table->dropColumn('meta');
            }
        });
    }
};
