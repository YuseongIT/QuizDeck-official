<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use App\Models\User;

class MigrateLocalProfileImagesToS3 extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'profile-images:migrate-to-s3 {--dry-run : Only show what would be migrated without uploading or modifying the DB}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Uploads locally stored profile images to S3 and updates users.profile_image to the S3 URL';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');

        $default = config('filesystems.default');
        if ($default !== 's3') {
            $this->warn("filesystems.default is '{$default}'. For final migration, set FILESYSTEM_DISK=s3 in .env and config:cache.");
        }

        $count = 0; $skipped = 0; $errors = 0;
        $this->info('Scanning users for local profile images...');

        User::whereNotNull('profile_image')->chunkById(200, function ($chunk) use (&$count, &$skipped, &$errors, $dry) {
            foreach ($chunk as $user) {
                $val = (string) $user->profile_image;
                if ($val === '') { $skipped++; continue; }

                // Determine relative path under public storage
                $rel = null;
                $lower = Str::lower($val);
                if (Str::startsWith($lower, ['http://','https://'])) {
                    // Handle legacy absolute URLs that still point to local files, e.g. http://localhost/profile_images/...
                    foreach (['/storage/profile_images/','/storage/profile_pictures/','/profile_images/','/profile_pictures/'] as $needle) {
                        $pos = stripos($val, $needle);
                        if ($pos !== false) {
                            $rel = substr($val, $pos + (strpos($needle, 'profile_') - 1) + 1); // from profile_...
                            break;
                        }
                    }
                    if (!$rel) { $skipped++; continue; }
                } else {
                    // Expect paths like /storage/profile_images/xxxxx.jpg or profile_images/xxxxx.jpg
                    $rel = ltrim($val, '/');
                    if (Str::startsWith($rel, 'storage/')) {
                        $rel = Str::after($rel, 'storage/'); // now profile_images/xxx.jpg
                    }
                }

                $localPath = storage_path('app/public/'.$rel);
                if (!is_file($localPath)) {
                    $this->warn("Missing file for user {$user->id}: {$localPath}");
                    $errors++; continue;
                }

                $filename = basename($localPath);
                $s3Key = $rel; // keep same relative key under the bucket for clarity

                try {
                    if ($dry) {
                        $this->line("DRY-RUN upload {$localPath} -> s3://".$s3Key);
                    } else {
                        // Stream upload to S3
                        $stream = fopen($localPath, 'r');
                        Storage::disk('s3')->put($s3Key, $stream, ['visibility' => 'public']);
                        if (is_resource($stream)) fclose($stream);

                        $url = Storage::disk('s3')->url($s3Key);
                        $old = $user->profile_image;
                        $user->profile_image = $url; // store full URL for S3
                        $user->save();
                        $this->info("Migrated user {$user->id}: {$old} -> {$url}");
                    }
                    $count++;
                } catch (\Throwable $e) {
                    $this->error("Failed migrating user {$user->id}: ".$e->getMessage());
                    $errors++;
                }
            }
        });

        $this->line("Done. migrated={$count}, skipped={$skipped}, errors={$errors}." );
        if ($dry) $this->line('Note: dry-run did not upload or update DB. Re-run without --dry-run to apply.');
        return Command::SUCCESS;
    }
}
