<?php
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';

$app->make(Kernel::class)->bootstrap();

try {
    $conn = DB::connection();
    $driver = $conn->getDriverName();
    $result = [
        'driver' => $driver,
        'database' => null,
        'tables' => [],
    ];

    if ($driver === 'mysql' || $driver === 'mariadb') {
        $dbName = $conn->getDatabaseName();
        $result['database'] = $dbName;
        $tables = $conn->select("SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name", [$dbName]);
        foreach ($tables as $t) {
            $table = $t->name;
            $cols = $conn->select(<<<SQL
                SELECT column_name   AS name,
                       data_type     AS data_type,
                       is_nullable   AS is_nullable,
                       column_default AS column_default,
                       character_maximum_length AS char_max_len,
                       numeric_precision, numeric_scale,
                       column_type    AS col_type,
                       extra          AS col_extra,
                       column_key     AS col_key
                FROM information_schema.columns
                WHERE table_schema = ? AND table_name = ?
                ORDER BY ordinal_position
            SQL, [$dbName, $table]);
            $result['tables'][$table] = array_map(function($c){ return [
                'name' => $c->name ?? null,
                'type' => $c->data_type ?? null,
                'nullable' => $c->is_nullable ?? null,
                'default' => $c->column_default ?? null,
                'char_max_len' => $c->char_max_len ?? null,
                'numeric_precision' => $c->numeric_precision ?? null,
                'numeric_scale' => $c->numeric_scale ?? null,
                'column_type' => ($c->col_type ?? null),
                'extra' => ($c->col_extra ?? null),
                'key' => ($c->col_key ?? null),
            ]; }, $cols);
        }
    } elseif ($driver === 'sqlite') {
        $dbPath = $conn->getConfig('database');
        $result['database'] = $dbPath;
        $tables = $conn->select("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        foreach ($tables as $t) {
            $table = $t->name;
            // Skip sqlite internal tables
            if (strpos($table, 'sqlite_') === 0) continue;
            $cols = $conn->select("PRAGMA table_info('".$table."')");
            $result['tables'][$table] = array_map(function($c){ return [
                'name' => $c->name,
                'type' => $c->type,
                'nullable' => ($c->notnull == 0 ? 'YES' : 'NO'),
                'default' => $c->dflt_value,
                'pk' => $c->pk,
            ]; }, $cols);
        }
    } else {
        $result['error'] = 'Unsupported driver for auto schema describe.';
    }

    echo json_encode($result, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES), PHP_EOL;
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, 'error='.$e->getMessage().PHP_EOL);
    exit(1);
}
