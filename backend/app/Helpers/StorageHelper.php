<?php

namespace App\Helpers;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class StorageHelper
{
    /**
     * Upload a file to S3 under the given prefix using a unique filename.
     * Optionally deletes the previous object if $oldUrl is provided.
     * Returns a cache-busted absolute URL.
     */
    public static function uploadToS3($file, string $prefix, ?string $oldUrl = null): string
    {
        if (!$file || !$file->isValid()) {
            throw new \InvalidArgumentException('Invalid file provided');
        }
        // IMPORTANT: Do NOT delete the previous object before upload to avoid brief broken state
        $ext = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        $filename = sprintf('%s-%s.%s', time(), Str::uuid()->toString(), $ext);
        $dir = trim($prefix, '/');
        $key = $dir . '/' . $filename;
        // Use putFileAs to avoid stream edge-cases and to set ContentType
        try {
            Storage::disk('s3')->putFileAs($dir, $file, $filename, [
                'visibility' => 'public',
                'CacheControl' => 'public, max-age=31536000',
                'ContentType' => $file->getClientMimeType() ?: 'image/'.$ext,
            ]);
        } catch (\Throwable $e) {
            Log::error('S3_PUTFILEAS_ERROR', ['error' => $e->getMessage(), 'key' => $key]);
            throw $e;
        }
        try { Storage::disk('s3')->setVisibility($key, 'public'); } catch (\Throwable $__) {}
        // Verify object exists immediately
        try {
            $exists = Storage::disk('s3')->exists($key);
            if (!$exists) {
                Log::error('S3_UPLOAD_VERIFICATION_FAILED', ['key' => $key, 'prefix' => $prefix]);
                throw new \RuntimeException('S3 upload verification failed for key: '.$key);
            } else {
                Log::info('S3_UPLOAD_OK', ['key' => $key]);
            }
        } catch (\Throwable $e) {
            Log::error('S3_UPLOAD_EXISTS_CHECK_ERROR', ['error' => $e->getMessage(), 'key' => $key]);
            throw $e;
        }
        $url = Storage::disk('s3')->url($key);
        if (str_starts_with($url, '/')) {
            $url = url($url);
        }
        if (strpos($url, '?v=') === false) {
            $url .= (str_contains($url, '?') ? '&' : '?') . 'v=' . time();
        }
        // After successful upload and URL generation, delete previous object if provided
        if ($oldUrl) {
            try {
                $oldKey = self::urlToS3Key($oldUrl);
                if ($oldKey && $oldKey !== $key) {
                    Storage::disk('s3')->delete($oldKey);
                }
            } catch (\Throwable $__) {}
        }
        return $url;
    }

    /**
     * Convert a typical S3 URL to the object key used by the bucket.
     */
    public static function urlToS3Key(string $url): ?string
    {
        $path = parse_url($url, PHP_URL_PATH) ?: '';
        // For virtual hosted–style URLs, path already starts with /<key>
        // Ensure no leading slash
        $path = ltrim($path, '/');
        // If path accidentally includes bucket name (path-style URLs), strip it
        // e.g. /quizdeck-profile-images/course_images/.. -> course_images/..
        if (preg_match('#^quizdeck-profile-images/(.+)$#', $path, $m)) {
            return $m[1];
        }
        return $path ?: null;
    }

    /**
     * Overwrite a fixed key under course_images/{id}/image.<ext>.
     * Does not delete first; writes in-place and returns cache-busted absolute URL.
     */
    public static function overwriteFixedCourseImage($file, int|string $courseId): string
    {
        if (!$file || !$file->isValid()) {
            throw new \InvalidArgumentException('Invalid file provided');
        }
        $dir = 'course_images/'.trim((string)$courseId, '/');
        $mime = $file->getClientMimeType() ?: '';
        $ext = strtolower($file->getClientOriginalExtension() ?: '');
        if (in_array($ext, ['jpeg','jpg'])) { $ext = 'jpg'; }
        if (!$ext) {
            if (str_contains($mime, 'png')) $ext = 'png';
            elseif (str_contains($mime, 'webp')) $ext = 'webp';
            else $ext = 'jpg';
        }
        if (!in_array($ext, ['jpg','png','webp'])) { $ext = 'jpg'; }
        $filename = 'image.'.$ext;
        $key = $dir.'/'.$filename;
        try {
            Storage::disk('s3')->putFileAs($dir, $file, $filename, [
                'CacheControl' => 'no-cache, no-store, must-revalidate',
                'ContentType' => $file->getClientMimeType() ?: ('image/'.$ext),
            ]);
        } catch (\Throwable $e) {
            Log::error('S3_PUTFILEAS_ERROR', ['error' => $e->getMessage(), 'key' => $key]);
            throw $e;
        }
        // Ensure object is publicly readable immediately (in case bucket policy doesn't enforce it)
        try { Storage::disk('s3')->setVisibility($key, 'public'); } catch (\Throwable $__) {}
        // Verify exists
        if (!Storage::disk('s3')->exists($key)) {
            Log::error('S3_OVERWRITE_VERIFY_FAILED', ['key' => $key]);
            throw new \RuntimeException('S3 overwrite verification failed for key: '.$key);
        }
        Log::info('S3_OVERWRITE_OK', ['key' => $key]);
        // Cleanup: remove other variants and stray files in course folder except current key
        try {
            $files = Storage::disk('s3')->allFiles($dir);
            foreach ($files as $f) {
                if ($f !== $key) {
                    Storage::disk('s3')->delete($f);
                }
            }
        } catch (\Throwable $__) {}
        $url = Storage::disk('s3')->url($key);
        if (str_starts_with($url, '/')) { $url = url($url); }
        $url .= (str_contains($url, '?') ? '&' : '?').'v='.time();
        return $url;
    }
}
