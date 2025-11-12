<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ListTableCountsCommand extends Command
{
    protected $signature = 'db:table-counts {--schema= : Optional schema/database name}';
    protected $description = 'List all tables with row counts for the current connection';

    public function handle(): int
    {
        $driver = config('database.default');
        $schema = $this->option('schema') ?: config('database.connections.'.$driver.'.database');
        $tables = [];
        try {
            if (in_array($driver, ['mysql','mariadb'])) {
                $rows = DB::select('SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name', [$schema]);
                foreach ($rows as $r) { $tables[] = $r->name; }
            } elseif ($driver === 'sqlite') {
                $rows = DB::select("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
                foreach ($rows as $r) { $tables[] = $r->name; }
            } elseif ($driver === 'pgsql') {
                $rows = DB::select("SELECT tablename AS name FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
                foreach ($rows as $r) { $tables[] = $r->name; }
            } else {
                $this->error('Unsupported driver: '.$driver);
                return self::FAILURE;
            }

            $data = [];
            foreach ($tables as $t) {
                try {
                    $count = DB::table($t)->count();
                } catch (\Throwable $e) {
                    $count = 'ERR';
                }
                $data[] = [$t, $count];
            }
            // Output
            $this->table(['Table','Rows'], $data);
            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error($e->getMessage());
            return self::FAILURE;
        }
    }
}
