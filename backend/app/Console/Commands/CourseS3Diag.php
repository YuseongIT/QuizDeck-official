<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Throwable;

class CourseS3Diag extends Command
{
    protected $signature = 'course:s3-diag {--prefix=course_images/diag : S3 prefix to write under}';
    protected $description = 'Write a diagnostic object to S3 to verify course_images write access and return its URL';

    public function handle(): int
    {
        $prefix = rtrim($this->option('prefix') ?: 'course_images/diag', '/');
        $key = $prefix.'/ping-'.time().'-'.bin2hex(random_bytes(3)).'.txt';
        $content = "quizdeck course s3 diag\n".date('c');
        try {
            Storage::disk('s3')->put($key, $content, [
                'visibility' => 'public',
                'ContentType' => 'text/plain',
                'CacheControl' => 'no-cache, no-store, must-revalidate',
            ]);
        } catch (Throwable $e) {
            $this->error('PUT failed: '.$e->getMessage());
            return self::FAILURE;
        }
        try { Storage::disk('s3')->setVisibility($key, 'public'); } catch (Throwable $__) {}
        $exists = Storage::disk('s3')->exists($key);
        $url = Storage::disk('s3')->url($key);
        $this->info('WROTE: '.$key);
        $this->info('EXISTS: '.($exists ? 'yes' : 'no'));
        $this->info('URL: '.$url);
        return $exists ? self::SUCCESS : self::FAILURE;
    }
}
