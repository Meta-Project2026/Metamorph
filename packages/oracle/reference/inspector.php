<?php
// Trusted inspector. Mounted ONLY in a separate sandbox, never in the application.
declare(strict_types=1);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
function check($ok): void { if (!$ok) throw new RuntimeException('inspection-error'); }
function enc($v): string { return json_encode($v, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION); }
function q(string $n): string { check((bool)preg_match('/^[A-Za-z_][A-Za-z_0-9]*$/D', $n)); return '"' . $n . '"'; }
try {
    $path = '/work/reference.sqlite';
    if (($argv[1] ?? '') === 'fixture') {
        $fixture = new PDO('sqlite:' . $path);
        $fixture->exec(file_get_contents('/fixture.sql'));
        $fixture = null;
    }
    check(is_file($path) && !is_link($path) && filesize($path) <= 8 * 1024 * 1024);
    foreach (glob('/work/*') as $file) check(is_file($file) && !is_link($file) && filesize($file) <= 8 * 1024 * 1024);
    $pdo = new PDO('sqlite:' . $path, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdo->exec('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON; PRAGMA busy_timeout=250; BEGIN;');
    $schema = $pdo->query("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' OR name='sqlite_sequence' ORDER BY type,name")->fetchAll(PDO::FETCH_ASSOC);
    check(count($schema) <= 256);
    $tables = [];
    foreach ($schema as $entry) {
        if ($entry['type'] !== 'table') continue;
        check(!preg_match('/^CREATE\s+VIRTUAL\s+TABLE/i', $entry['sql'] ?? ''));
        $name = $entry['name'];
        $columns = $pdo->query('PRAGMA table_xinfo(' . q($name) . ')')->fetchAll(PDO::FETCH_ASSOC);
        check(count($columns) > 0 && count($columns) <= 256);
        $select = []; $order = [];
        foreach ($columns as $i => $column) {
            check((int)$column['hidden'] === 0);
            $c = q($column['name']);
            $select[] = 'typeof(' . $c . ') AS ' . q('t' . $i);
            $select[] = "CASE WHEN typeof($c)='blob' THEN hex($c) WHEN typeof($c)='integer' THEN CAST($c AS TEXT) ELSE $c END AS " . q('v' . $i);
            if ((int)$column['pk'] > 0) $order[(int)$column['pk']] = $c;
        }
        ksort($order);
        $query = 'SELECT ' . implode(',', $select) . ' FROM ' . q($name);
        if ($order) $query .= ' ORDER BY ' . implode(',', $order);
        $raw = $pdo->query($query . ' LIMIT 10001')->fetchAll(PDO::FETCH_ASSOC);
        check(count($raw) <= 10000);
        $rows = [];
        foreach ($raw as $row) {
            $cells = [];
            foreach ($columns as $i => $column) $cells[] = ['type' => $row['t' . $i], 'value' => $row['v' . $i]];
            $rows[] = $cells;
        }
        if (!$order) usort($rows, function ($a, $b) { return strcmp(enc($a), enc($b)); });
        $tables[] = ['name' => $name, 'columns' => $columns, 'rows' => $rows];
    }
    $pdo->exec('COMMIT;');
    $state = ['format' => 'php74-logical-v1', 'schema' => $schema, 'tables' => $tables];
    $start = hrtime(true); usleep(50000); $elapsed = (hrtime(true) - $start) / 1000000;
    $runtime = ['php'=>PHP_VERSION, 'sqlite'=>$pdo->query('SELECT sqlite_version()')->fetchColumn(), 'extensions'=>get_loaded_extensions(),
        'phpUtc'=>gmdate('Y-m-d H:i:s'), 'sqliteUtc'=>$pdo->query("SELECT datetime('now')")->fetchColumn(), 'monotonicMs'=>$elapsed,
        'clockNoticeSha256'=>hash_file('sha256','/usr/share/doc/libfaketime/copyright')];
    check(PHP_VERSION === '7.4.33' && $runtime['sqlite'] === '3.34.1');
    check($runtime['phpUtc'] === '2026-10-27 12:00:00' && $runtime['sqliteUtc'] === $runtime['phpUtc'] && $elapsed >= 40 && $elapsed < 2000);
    $output = enc(['stateBase64'=>base64_encode(enc($state)), 'legacySha256'=>hash('sha256',enc($state)), 'runtime'=>$runtime]);
    check(strlen($output) <= 8 * 1024 * 1024);
    echo $output;
} catch (Throwable $error) {
    // Diagnostics remain on the broker's private stderr channel.
    file_put_contents('php://stderr', get_class($error) . ':' . $error->getMessage());
    exit(1);
}
