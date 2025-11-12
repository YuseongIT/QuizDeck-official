<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Aws\S3\S3Client;
use Aws\Exception\AwsException;
use Throwable;

class S3Probe extends Command
{
    protected $signature = 's3:probe {--prefix=diagnostics/qd-probe : Prefix to test PutObject}';
    protected $description = 'Print effective S3 config (bucket/region/endpoint) and run HeadBucket + PutObject with detailed AWS error output';

    public function handle(): int
    {
        $disk = 's3';
        $cfg = [
            'driver' => Config::get("filesystems.disks.$disk.driver"),
            'key' => substr((string) env('AWS_ACCESS_KEY_ID'), 0, 4) ? '***' : '(empty)',
            'secret' => env('AWS_SECRET_ACCESS_KEY') ? '***' : '(empty)',
            'region' => Config::get("filesystems.disks.$disk.region"),
            'bucket' => Config::get("filesystems.disks.$disk.bucket"),
            'url' => Config::get("filesystems.disks.$disk.url"),
            'endpoint' => Config::get("filesystems.disks.$disk.endpoint"),
            'use_path_style_endpoint' => Config::get("filesystems.disks.$disk.use_path_style_endpoint"),
        ];
        $this->info('Effective S3 config:');
        foreach ($cfg as $k => $v) {
            $this->line("  $k: ".(is_bool($v)?($v?'true':'false'):($v!==null?$v:'(null)')));
        }

        // 1) HeadBucket via AWS SDK
        try {
            $client = new S3Client([
                'version' => 'latest',
                'region' => (string)$cfg['region'],
                'credentials' => [
                    'key' => (string) env('AWS_ACCESS_KEY_ID'),
                    'secret' => (string) env('AWS_SECRET_ACCESS_KEY'),
                ],
                'endpoint' => $cfg['endpoint'] ?: null,
                'use_path_style_endpoint' => (bool)$cfg['use_path_style_endpoint'],
            ]);
            $client->headBucket(['Bucket' => (string)$cfg['bucket']]);
            $this->info('HeadBucket OK');
        } catch (AwsException $e) {
            $this->error('HeadBucket failed: code='.$e->getAwsErrorCode().' status='.$e->getStatusCode().' msg='.$e->getAwsErrorMessage());
        } catch (Throwable $e) {
            $this->error('HeadBucket failed: '.$e->getMessage());
        }

        // 2) Try PutObject
        $prefix = rtrim($this->option('prefix') ?: 'diagnostics/qd-probe', '/');
        $key = $prefix.'/probe-'.time().'-'.bin2hex(random_bytes(3)).'.txt';
        try {
            $client = new S3Client([
                'version' => 'latest',
                'region' => (string)$cfg['region'],
                'credentials' => [
                    'key' => (string) env('AWS_ACCESS_KEY_ID'),
                    'secret' => (string) env('AWS_SECRET_ACCESS_KEY'),
                ],
                'endpoint' => $cfg['endpoint'] ?: null,
                'use_path_style_endpoint' => (bool)$cfg['use_path_style_endpoint'],
            ]);
            $client->putObject([
                'Bucket' => (string)$cfg['bucket'],
                'Key' => $key,
                'Body' => "s3 probe\n".date('c'),
                'ContentType' => 'text/plain',
            ]);
            $this->info('PutObject OK: '.$key);
        } catch (AwsException $e) {
            $this->error('PutObject failed: code='.$e->getAwsErrorCode().' status='.$e->getStatusCode().' msg='.$e->getAwsErrorMessage());
            return self::FAILURE;
        } catch (Throwable $e) {
            $this->error('PutObject failed: '.$e->getMessage());
            return self::FAILURE;
        }

        // 3) Try URL and existence
        try {
            $exists = Storage::disk('s3')->exists($key);
            $url = Storage::disk('s3')->url($key);
            $this->info('Exists: '.($exists?'yes':'no'));
            $this->info('URL: '.$url);
        } catch (Throwable $e) {
            $this->error('Post-Put checks failed: '.$e->getMessage());
        }

        return self::SUCCESS;
    }
}
