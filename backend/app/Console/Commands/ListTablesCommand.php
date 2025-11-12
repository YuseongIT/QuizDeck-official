<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ListTablesCommand extends Command
{
    protected $signature = 'db:tables {--schema= : Optional schema/database name}';
    protected $description = 'List all tables in the current database connection';

    public function handle(): int
    {
        try {
            $schema = $this->option('schema') ?: config('database.connections.'.config('database.default').'.database');
            $driver = config('database.default');
            if ($driver === 'mysql' || $driver === 'mariadb') {
                $rows = DB::select('SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name', [$schema]);
                foreach ($rows as $r) { $this->line($r->name); }
                $this->info('Total: '.count($rows));
                return self::SUCCESS;
            } elseif ($driver === 'sqlite') {
                $rows = DB::select("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
                foreach ($rows as $r) { $this->line($r->name); }
                $this->info('Total: '.count($rows));
                return self::SUCCESS;
            } elseif ($driver === 'pgsql') {
                $rows = DB::select("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
                foreach ($rows as $r) { $this->line($r->tablename); }
                $this->info('Total: '.count($rows));
                return self::SUCCESS;
            }
            $this->error('Unsupported driver: '.$driver);
            return self::FAILURE;
        } catch (\Throwable $e) {
            $this->error($e->getMessage());
            return self::FAILURE;
        }
    }
}
