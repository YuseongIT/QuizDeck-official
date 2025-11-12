<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

class PurgeCourses extends Command
{
    protected $signature = 'courses:purge {--yes : Confirm purge of ALL courses and S3 course_images} {--force : Alias for --yes}';
    protected $description = 'Delete ALL courses and remove ALL S3 objects under course_images/';

    public function handle(): int
    {
        if (!($this->option('yes') || $this->option('force'))) {
            $this->error('Refusing to run without --yes. This will delete ALL courses and S3 course images.');
            return self::FAILURE;
        }

        $this->warn('Purging ALL courses and ALL S3 objects under course_images/...');

        // Delete S3 objects first
        try {
            $disk = Storage::disk('s3');
            $all = $disk->allFiles('course_images');
            $count = count($all);
            if ($count > 0) {
                $disk->delete($all);
            }
            $this->info("Deleted {$count} S3 objects under course_images/");
        } catch (Throwable $e) {
            $this->error('Failed deleting S3 objects: '.$e->getMessage());
            // continue to DB purge
        }

        // Truncate table
        try {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
            DB::table('courses')->truncate();
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
            $this->info('Truncated courses table.');
        } catch (Throwable $e) {
            $this->error('Failed truncating courses table: '.$e->getMessage());
            return self::FAILURE;
        }

        $this->info('Purge complete.');
        return self::SUCCESS;
    }
}
