<?php
// Bootstrap Laravel and delete all users while keeping the table

use Illuminate\Contracts\Console\Kernel;

require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';

$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

// Now we can use Eloquent models
/** @var \Illuminate\Database\ConnectionInterface $db */

try {
    /** @var \App\Models\User $userModel */
    $before = \App\Models\User::count();
    echo "users_before=" . $before . PHP_EOL;

    \App\Models\User::query()->delete();

    $after = \App\Models\User::count();
    echo "users_after=" . $after . PHP_EOL;
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, 'error=' . $e->getMessage() . PHP_EOL);
    exit(1);
}
