<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('quiz_items', function (Blueprint $table) {
            if (!Schema::hasColumn('quiz_items', 'media_path')) {
                $table->string('media_path')->nullable()->after('image_path');
            }
            if (!Schema::hasColumn('quiz_items', 'media_type')) {
                $table->string('media_type')->nullable()->after('media_path');
            }
        });
    }

    public function down(): void
    {
        Schema::table('quiz_items', function (Blueprint $table) {
            if (Schema::hasColumn('quiz_items', 'media_type')) {
                $table->dropColumn('media_type');
            }
            if (Schema::hasColumn('quiz_items', 'media_path')) {
                $table->dropColumn('media_path');
            }
        });
    }
};
