<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class PurgeQuizzes extends Command
{
    protected $signature = 'quizzes:purge {--images : Also delete stored images for quiz items if paths are present} {--dry-run : Show what would be deleted without changing anything} {--truncate : Use TRUNCATE for maximum speed (skips model events)}';

    protected $description = 'Delete ALL quizzes and related data (items, choices, attempts, responses). Optional: delete stored images.';

    public function handle()
    {
        $dry = (bool)$this->option('dry-run');
        $withImages = (bool)$this->option('images');
        $useTruncate = (bool)$this->option('truncate');

        $this->warn('DESTRUCTIVE OPERATION: This will delete ALL quizzes and related data.');
        if ($dry) {
            $this->info('Running in DRY RUN mode. No changes will be made.');
        }

        // Counts for preview
        $counts = DB::table('quizzes')->count();
        $items = DB::table('quiz_items')->count();
        $choices = DB::table('quiz_choices')->count();
        $attempts = DB::table('quiz_attempts')->count();
        $responses = DB::table('quiz_responses')->count();

        $this->line("Quizzes: $counts, Items: $items, Choices: $choices, Attempts: $attempts, Responses: $responses");

        if (!$this->confirm('Proceed?')) {
            $this->info('Aborted.');
            return Command::SUCCESS;
        }

        try {
            if ($withImages) {
                $this->info('Deleting stored images (best-effort)...');
                $this->deleteImages($dry);
            }

            if ($useTruncate) {
                $this->info('Purging with TRUNCATE (FK checks temporarily disabled)...');
                if (!$dry) {
                    DB::statement('SET FOREIGN_KEY_CHECKS=0');
                    DB::table('quiz_responses')->truncate();
                    DB::table('quiz_attempts')->truncate();
                    DB::table('quiz_choices')->truncate();
                    DB::table('quiz_items')->truncate();
                    DB::table('quizzes')->truncate();
                    DB::statement('SET FOREIGN_KEY_CHECKS=1');
                }
            } else {
                $this->info('Purging with DELETE (model events not fired here; direct DB delete) ...');
                if (!$dry) {
                    DB::transaction(function () {
                        DB::table('quiz_responses')->delete();
                        DB::table('quiz_attempts')->delete();
                        DB::table('quiz_choices')->delete();
                        DB::table('quiz_items')->delete();
                        DB::table('quizzes')->delete();
                    });
                }
            }

            $this->info('Purge completed. Verifying counts...');
            $post = [
                'quizzes' => DB::table('quizzes')->count(),
                'items' => DB::table('quiz_items')->count(),
                'choices' => DB::table('quiz_choices')->count(),
                'attempts' => DB::table('quiz_attempts')->count(),
                'responses' => DB::table('quiz_responses')->count(),
            ];
            $this->line(json_encode($post));
        } catch (\Throwable $e) {
            Log::error('quizzes:purge failed', ['error' => $e->getMessage()]);
            $this->error('Error: ' . $e->getMessage());
            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }

    protected function deleteImages(bool $dry)
    {
        // Best-effort deletion: try to parse stored paths in quiz_items.image_path
        $total = 0; $deleted = 0; $skipped = 0; $errors = 0;
        $chunk = 500;
        DB::table('quiz_items')->whereNotNull('image_path')->orderBy('id')->chunkById($chunk, function ($rows) use (&$total, &$deleted, &$skipped, &$errors, $dry) {
            foreach ($rows as $r) {
                $total++;
                $path = (string)($r->image_path ?? '');
                if ($path === '') { $skipped++; continue; }

                // If full URL, try to map to a storage path (/storage/...) otherwise skip
                $storagePath = $this->toStoragePath($path);
                if (!$storagePath) { $skipped++; continue; }

                if ($dry) {
                    $this->line("DRY: would delete $storagePath");
                    continue;
                }

                try {
                    if (Storage::exists($storagePath)) {
                        Storage::delete($storagePath);
                        $deleted++;
                    } else {
                        // Try default public disk variant
                        if (Storage::disk('public')->exists($storagePath)) {
                            Storage::disk('public')->delete($storagePath);
                            $deleted++;
                        } else {
                            $skipped++;
                        }
                    }
                } catch (\Throwable $e) {
                    $errors++;
                    Log::warning('Failed deleting quiz item image', ['path' => $storagePath, 'err' => $e->getMessage()]);
                }
            }
        });
        $this->line("Images scanned: $total; deleted: $deleted; skipped: $skipped; errors: $errors");
    }

    protected function toStoragePath(string $u): ?string
    {
        // Normalize common relative variants
        $u = trim($u);
        if ($u === '') return null;

        // If absolute URL and includes /storage/, strip domain
        if (preg_match('~^https?://~i', $u)) {
            $parts = parse_url($u);
            $path = $parts['path'] ?? '';
            if ($path && str_starts_with($path, '/storage/')) {
                return ltrim($path, '/'); // storage/...
            }
            // Could be an S3 key embedded; without a clear prefix, skip
            return null;
        }

        // Already like storage/... or /storage/...
        if (str_starts_with($u, '/')) $u = ltrim($u, '/');
        if (str_starts_with($u, 'storage/')) return $u;
        if (str_starts_with($u, 'profile_images/')) return 'storage/' . $u; // legacy mapping

        // If it looks like a raw key under public disk, try as-is
        return $u ?: null;
    }
}
