<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // Make `type` a plain VARCHAR to support new item types (matching, ordering, etc.)
        DB::statement("ALTER TABLE quiz_items MODIFY COLUMN type VARCHAR(32) NOT NULL");
    }

    public function down(): void
    {
        // Optional: revert to smaller size if needed (kept as VARCHAR(16) for safety)
        DB::statement("ALTER TABLE quiz_items MODIFY COLUMN type VARCHAR(16) NOT NULL");
    }
};
