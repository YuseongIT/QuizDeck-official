<?php
declare(strict_types=1);

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';

/** @var Kernel $kernel */
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

try {
    $rows = DB::select('SHOW TABLES');
    $tables = [];
    foreach ($rows as $row) {
        $arr = (array)$row;
        $tables[] = array_values($arr)[0] ?? '';
    }
    echo "Tables (" . count($tables) . ")\n";
    foreach ($tables as $t) {
        echo "- " . $t . "\n";
    }
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, 'List tables failed: ' . $e->getMessage() . "\n");
    exit(1);
}
