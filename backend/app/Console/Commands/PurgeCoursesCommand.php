<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PurgeCoursesCommand extends Command
{
    protected $signature = 'courses:purge {--force : Run without confirmation prompt}';
    protected $description = 'Delete all courses and related data (enrollments, quizzes, announcements)';

    public function handle(): int
    {
        if (!$this->option('force') && !$this->confirm('This will permanently delete ALL courses and related records. Continue?')) {
            $this->warn('Aborted.');
            return self::INVALID;
        }

        DB::transaction(function () {
            // Best-effort deletes in dependency order
            if (DB::getSchemaBuilder()->hasTable('enrollments')) {
                DB::table('enrollments')->delete();
            }
            if (DB::getSchemaBuilder()->hasTable('quizzes')) {
                DB::table('quizzes')->delete();
            }
            if (DB::getSchemaBuilder()->hasTable('announcements')) {
                try { DB::table('announcements')->delete(); } catch (\Throwable $e) { /* ignore if unrelated */ }
            }
            if (DB::getSchemaBuilder()->hasTable('courses')) {
                DB::table('courses')->delete();
            }
        });

        $this->info('All courses and related records have been deleted.');
        return self::SUCCESS;
    }
}
