<?php
// Trusted reference-only probe; run exclusively in the bounded disposable container.
declare(strict_types=1);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', '/work/private/php-errors.log');
umask(0077);
mkdir('/work/private', 0700, true);

function encode($value): string {
    return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);
}
function digest($value): string { return hash('sha256', encode($value)); }
function savePrivate(string $path, $value): void { file_put_contents('/work/private/' . $path, encode($value)); }
function requireCheck(bool $condition): void { if (!$condition) throw new RuntimeException('business-check-failed'); }
function quoteSql(string $name): string { return '"' . str_replace('"', '""', $name) . '"'; }
function connection(string $path): PDO {
    $pdo = new PDO('sqlite:' . $path, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdo->exec('PRAGMA busy_timeout=500; PRAGMA trusted_schema=OFF;');
    return $pdo;
}
function snapshot(string $path): array {
    $pdo = connection($path);
    $pdo->exec('PRAGMA query_only=ON; BEGIN;');
    $schema = $pdo->query("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' OR name='sqlite_sequence' ORDER BY type,name")->fetchAll(PDO::FETCH_ASSOC);
    $tables = [];
    foreach ($schema as $entry) {
        if ($entry['type'] !== 'table') continue;
        $name = $entry['name'];
        $columns = $pdo->query('PRAGMA table_xinfo(' . quoteSql($name) . ')')->fetchAll(PDO::FETCH_ASSOC);
        $select = []; $order = [];
        foreach ($columns as $index => $column) {
            $q = quoteSql($column['name']);
            $select[] = 'typeof(' . $q . ') AS ' . quoteSql('t' . $index);
            // Textual integer preserves int64 even on runtimes with PDO conversion quirks.
            $select[] = "CASE WHEN typeof($q)='blob' THEN hex($q) WHEN typeof($q)='integer' THEN CAST($q AS TEXT) ELSE $q END AS " . quoteSql('v' . $index);
            if ((int)$column['pk'] > 0) $order[(int)$column['pk']] = $q;
        }
        ksort($order);
        $query = 'SELECT ' . implode(',', $select) . ' FROM ' . quoteSql($name);
        if ($order) $query .= ' ORDER BY ' . implode(',', $order);
        $raw = $pdo->query($query . ' LIMIT 10001')->fetchAll(PDO::FETCH_ASSOC);
        requireCheck(count($raw) <= 10000);
        $rows = [];
        foreach ($raw as $row) {
            $cells = [];
            foreach ($columns as $index => $column) $cells[] = ['type' => $row['t' . $index], 'value' => $row['v' . $index]];
            $rows[] = $cells;
        }
        if (!$order) usort($rows, function ($a, $b) { return strcmp(encode($a), encode($b)); });
        $tables[] = ['name' => $name, 'columns' => $columns, 'rows' => $rows];
    }
    $pdo->exec('COMMIT;');
    return ['format' => 'php74-logical-v1', 'schema' => $schema, 'tables' => $tables];
}
function counts(array $state): array {
    $result = [];
    foreach ($state['tables'] as $table) $result[$table['name']] = count($table['rows']);
    return $result;
}
function command(array $args, string $cwd, string $log): int {
    $process = proc_open($args, [0 => ['file', '/dev/null', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes, $cwd);
    if (!is_resource($process)) throw new RuntimeException('process-start-failed');
    return proc_close($process);
}
function startServer(string $cwd, bool $exam, string $log) {
    $args = ['php', '-d', 'display_errors=0', '-d', 'log_errors=1', '-S', '127.0.0.1:8080'];
    if ($exam) $args = array_merge($args, ['-t', 'public', 'public/index.php']);
    $process = proc_open($args, [0 => ['file','/dev/null','r'], 1 => ['file',$log,'a'], 2 => ['file',$log,'a']], $pipes, $cwd);
    if (!is_resource($process)) throw new RuntimeException('server-start-failed');
    for ($attempt=0; $attempt<50; $attempt++) {
        $socket = @fsockopen('127.0.0.1', 8080, $errno, $errstr, 0.1);
        if ($socket) { fclose($socket); return $process; }
        usleep(100000);
    }
    proc_terminate($process); proc_close($process);
    throw new RuntimeException('server-not-ready');
}
function stopServer($process): void {
    if (is_resource($process)) { proc_terminate($process); proc_close($process); usleep(100000); }
}
function httpRequest(string $method, string $path, array $form): array {
    $body = $method === 'POST' ? http_build_query($form) : '';
    $options = ['method'=>$method,'ignore_errors'=>true,'follow_location'=>0,'timeout'=>5,'header'=>"Connection: close\r\n"];
    if ($method === 'POST') { $options['header'] .= "Content-Type: application/x-www-form-urlencoded\r\n"; $options['content'] = $body; }
    $response = file_get_contents('http://127.0.0.1:8080' . $path, false, stream_context_create(['http'=>$options]));
    if ($response === false) throw new RuntimeException('http-request-failed');
    $rawHeaders = $http_response_header;
    requireCheck((bool)preg_match('~^HTTP/[^ ]+ ([0-9]{3})~', $rawHeaders[0], $matches));
    $headers = [];
    foreach (array_slice($rawHeaders,1) as $header) {
        $parts = explode(':', $header, 2);
        if (count($parts)===2) $headers[strtolower(trim($parts[0]))] = trim($parts[1]);
    }
    $stable = [];
    foreach (['content-type','location','cache-control','allow','content-disposition'] as $key) if (isset($headers[$key])) $stable[$key] = $headers[$key];
    return ['status'=>(int)$matches[1],'headers'=>$stable,'rawHeaders'=>$rawHeaders,'body'=>$response,'requestBody'=>$body];
}

$mode = $argv[1] ?? '';
requireCheck(in_array($mode, ['examsuite','workshop'], true));
$exam = $mode === 'examsuite';
$runtime = ['phpVersion'=>PHP_VERSION,'sqliteVersion'=>SQLite3::version()['versionString'],'extensions'=>get_loaded_extensions()];
$result = ['format'=>'php74-qualification-v1','mode'=>$mode,'runtime'=>$runtime,'checks'=>[],'scenarios'=>[],'bootstrapStatus'=>'NOT_RUN','statefulReplayStatus'=>'NOT_RUN','decision'=>'BLOCKED'];
$source = '/work/pristine';
mkdir($source,0700);
$tarExit = command(['tar','-xzf','/input/source.tgz','-C',$source,'--strip-components=1','--no-same-owner','--no-same-permissions'],'/work','/work/private/archive.log');
$result['checks'][] = ['id'=>'archive-extract','exitCode'=>$tarExit];
if ($tarExit !== 0) { echo encode($result); exit(1); }
requireCheck(is_file($source . '/LICENSE'));
$result['licenseSha256'] = hash_file('sha256',$source . '/LICENSE');
$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS));
$lintExit = 0; $lintFiles = 0;
foreach ($files as $file) {
    if ($file->isFile() && $file->getExtension()==='php') {
        $lintFiles++;
        if (command(['php','-l',$file->getPathname()],$source,'/work/private/lint.log')!==0) $lintExit=1;
    }
}
$result['checks'][] = ['id'=>'php-lint','exitCode'=>$lintExit,'fileCount'=>$lintFiles];
if ($lintExit!==0 || PHP_VERSION!=='7.4.33' || !extension_loaded('pdo_sqlite') || !extension_loaded('mbstring')) {
    $result['bootstrapStatus']='FAIL'; $result['decision']='NO-GO'; echo encode($result); exit(0);
}
$ids = $exam ? ['exam-business','exam-rejected','exam-fresh'] : ['workshop-business','workshop-rejected','workshop-capacity'];
foreach ($ids as $scenarioId) {
    for ($replay=1; $replay<=2; $replay++) {
        $name = $scenarioId . '-' . $replay;
        $root = '/work/' . $name;
        mkdir($root,0700);
        $copyExit = command(['cp','-a',$source . '/.',$root],'/work','/work/private/copy.log');
        $scenario = ['scenarioId'=>$scenarioId,'replay'=>$replay,'dbPath'=>$root . ($exam ? '/storage/tech2teach.sqlite':'/workshop.sqlite'),'steps'=>[],'exitCode'=>1,'status'=>'ERROR'];
        $dbPath = $scenario['dbPath'];
        $server = null;
        try {
            requireCheck($copyExit===0);
            if ($exam) {
                foreach (['scripts/init_db.php','scripts/seed_questions.php'] as $script) {
                    $exit = command(['php',$script],$root,'/work/private/' . $name . '-init.log');
                    $result['checks'][] = ['id'=>$scenarioId . ':' . $replay . ':' . basename($script),'exitCode'=>$exit];
                    requireCheck($exit===0);
                }
            }
            $server = startServer($root,$exam,'/work/private/' . $name . '-server.log');
            // Workshop initializes its DB lazily. This bootstrap request is captured privately.
            $boot = httpRequest('GET','/',[]);
            savePrivate($name . '-boot.json',$boot);
            requireCheck($boot['status']===200);
            if (!$exam) {
                // A read invokes PDO setup; then freeze fresh-state counts for assertions.
                $init = httpRequest('GET','/api.php?action=get_slots&date=2099-06-15',[]);
                savePrivate($name . '-init.json',$init);
                requireCheck($init['status']===200);
            }
            requireCheck(is_file($dbPath));
            $initial = snapshot($dbPath);
            savePrivate($name . '-initial.json',$initial);
            $scenario['initialSha256'] = digest($initial);
            $scenario['initialCounts'] = counts($initial);
            requireCheck(($scenario['initialCounts'][$exam?'intakes':'appointments'] ?? -1)===0);
            $result['bootstrapStatus']='PASS';
            $step = function (string $id,string $method,string $path,array $form,callable $assertion) use (&$scenario,$dbPath,$name) {
                $started = microtime(true);
                $before = snapshot($dbPath);
                $response = httpRequest($method,$path,$form);
                $after = snapshot($dbPath);
                $observation = ['request'=>['method'=>$method,'path'=>$path,'body'=>$response['requestBody']],'response'=>$response,'before'=>$before,'after'=>$after];
                savePrivate($name . '-' . $id . '.json',$observation);
                $record = ['stepId'=>$id,'method'=>$method,'status'=>$response['status'],'responseSha256'=>hash('sha256',$response['body']),'stableHeadersSha256'=>digest($response['headers']),'beforeSha256'=>digest($before),'afterSha256'=>digest($after),'beforeCounts'=>counts($before),'afterCounts'=>counts($after),'unchanged'=>digest($before)===digest($after),'elapsedMs'=>(int)round((microtime(true)-$started)*1000),'exitCode'=>1];
                try { $assertion($response,$before,$after); $record['exitCode']=0; }
                finally { $scenario['steps'][]=$record; }
                return $response;
            };
            $readOnly = function ($response,$before,$after) { requireCheck($response['status']===200 && digest($before)===digest($after)); };
            if ($exam) {
                if ($scenarioId==='exam-rejected') {
                    $step('invalid-intake','POST','/intake/crear',['title'=>'','raw_text'=>''],function ($r,$a,$b) { requireCheck($r['status']===200 && digest($a)===digest($b) && strpos($r['body'],'obligatorios')!==false); });
                    $step('read-home','GET','/',[],$readOnly);
                    $step('missing-pack','GET','/pack/ver?id=qualification-missing',[],function ($r,$a,$b) { requireCheck($r['status']===404 && digest($a)===digest($b)); });
                    $step('read-after-rejection','GET','/',[],$readOnly);
                } else {
                    $create = $step('create-intake','POST','/intake/crear',['title'=>'Qualification networking','raw_text'=>"- network routing diagnostics\n- network security verification"],function ($r,$a,$b) { requireCheck($r['status']===302 && counts($b)['intakes']===counts($a)['intakes']+1); });
                    $location = $create['headers']['location'] ?? '';
                    requireCheck((bool)preg_match('~^/pack/ver\?id=([a-f0-9]{32})$~',$location,$matches));
                    $intakeId = $matches[1];
                    $step('read-pack','GET',$location,[],$readOnly);
                    if ($scenarioId==='exam-business') {
                        $generated = $step('generate-exam','POST','/exam/generar',['intake_id'=>$intakeId,'variant'=>'A','num_questions'=>'5','level'=>'mixto','topic_hint'=>''],function ($r,$a,$b) { requireCheck($r['status']===302 && counts($b)['exams']===1 && counts($b)['exam_questions']>0); });
                        $target = $generated['headers']['location'] ?? '';
                        requireCheck((bool)preg_match('~^/exam/tomar\?id=([a-f0-9]{32})$~',$target,$examMatch));
                        $examId=$examMatch[1];
                        $step('take-exam','GET',$target,[],$readOnly);
                        // Submit no answers: no upstream correct choices are used as probe inputs.
                        $step('grade-empty-answers','POST','/exam/corregir',['exam_id'=>$examId],function ($r,$a,$b) { requireCheck($r['status']===302 && counts($b)['attempts']===1); });
                        $step('read-results','GET','/exam/resultados?id=' . $examId,[],$readOnly);
                        $step('export-json','GET','/exam/export?id=' . $examId . '&type=json',[],function ($r,$a,$b) { requireCheck($r['status']===200 && digest($a)===digest($b)); $json=json_decode($r['body'],true,512,JSON_THROW_ON_ERROR); requireCheck(isset($json['exam']['questions']) && count($json['exam']['questions'])>0); });
                    }
                }
            } else {
                $api='/api.php?action=';
                $date='2099-06-15';
                $booking=function (int $index) use ($date) { return ['client_name'=>'Public Qualification ' . $index,'address'=>'Synthetic address','phone'=>'+15550000' . $index,'car_license'=>'QUAL-' . $index,'car_engine'=>'ENGINE-' . $index,'appointment_date'=>$date,'mechanic_id'=>'1']; };
                $success=function ($r,$a,$b) { $j=json_decode($r['body'],true,512,JSON_THROW_ON_ERROR); requireCheck($r['status']===200 && ($j['success']??false)===true); };
                if ($scenarioId==='workshop-business') {
                    $book=$step('book','POST',$api.'book',$booking(1),function ($r,$a,$b) use ($success) { $success($r,$a,$b); requireCheck(counts($b)['appointments']===1); });
                    $appointment=json_decode($book['body'],true)['appointment_id'];
                    $step('read-booking','GET',$api.'get_appointments',[],function ($r,$a,$b) use ($readOnly) { $readOnly($r,$a,$b); $j=json_decode($r['body'],true); requireCheck(count($j['appointments'])===1 && $j['appointments'][0]['client_name']==='Public Qualification 1'); });
                    $step('update','POST',$api.'update_appointment',['id'=>$appointment,'appointment_date'=>'2099-06-16','mechanic_id'=>'2'],$success);
                    $step('read-update','GET',$api.'get_appointments',[],function ($r,$a,$b) use ($readOnly) { $readOnly($r,$a,$b); $j=json_decode($r['body'],true); requireCheck($j['appointments'][0]['appointment_date']==='2099-06-16' && (int)$j['appointments'][0]['mechanic_id']===2); });
                    $step('cancel','POST',$api.'cancel_appointment',['id'=>$appointment],function ($r,$a,$b) use ($success) { $success($r,$a,$b); requireCheck(counts($b)['appointments']===0); });
                    $step('read-cancel','GET',$api.'get_appointments',[],function ($r,$a,$b) use ($readOnly) { $readOnly($r,$a,$b); requireCheck(count(json_decode($r['body'],true)['appointments'])===0); });
                } elseif ($scenarioId==='workshop-rejected') {
                    $step('book','POST',$api.'book',$booking(1),$success);
                    $step('duplicate','POST',$api.'book',$booking(1),function ($r,$a,$b) { $j=json_decode($r['body'],true); requireCheck(($j['error_type']??'')==='DUPLICATE_CLIENT' && digest($a)===digest($b)); });
                    $step('read-after-duplicate','GET',$api.'get_appointments',[],$readOnly);
                    $step('invalid-booking','POST',$api.'book',[],function ($r,$a,$b) { $j=json_decode($r['body'],true); requireCheck(($j['success']??true)===false && digest($a)===digest($b)); });
                    $step('read-after-invalid','GET',$api.'get_appointments',[],$readOnly);
                } else {
                    for ($i=1;$i<=4;$i++) $step('fill-'.$i,'POST',$api.'book',$booking($i),$success);
                    $step('over-capacity','POST',$api.'book',$booking(5),function ($r,$a,$b) { $j=json_decode($r['body'],true); requireCheck(($j['error_type']??'')==='MECHANIC_FULL' && digest($a)===digest($b) && counts($b)['appointments']===4); });
                    $step('read-after-capacity','GET',$api.'get_slots&date='.$date,[],function ($r,$a,$b) use ($readOnly) { $readOnly($r,$a,$b); $j=json_decode($r['body'],true); requireCheck($j['mechanics'][0]['booked_count']===4 && $j['mechanics'][0]['is_full']===true); });
                }
            }
            $scenario['exitCode']=0; $scenario['status']='PASS';
        } catch (Throwable $error) {
            savePrivate($name . '-error.json',['class'=>get_class($error),'message'=>$error->getMessage()]);
            $scenario['status']='FAIL';
        } finally {
            stopServer($server);
            $result['scenarios'][]=$scenario;
        }
        // Ensure wall-clock differences are observable; never rely on same-second timestamps.
        if ($replay===1) sleep(2);
    }
}
$all = count($result['scenarios'])===6;
foreach ($result['scenarios'] as $scenario) if ($scenario['exitCode']!==0) $all=false;
$result['statefulReplayStatus']=$all?'PASS':'FAIL';
$result['exactReplayEqual']=true;
for ($i=0;$i<count($result['scenarios']);$i+=2) {
    $a=$result['scenarios'][$i]; $b=$result['scenarios'][$i+1];
    if (($a['initialSha256']??null)!==($b['initialSha256']??null)) $result['exactReplayEqual']=false;
    foreach ($a['steps'] as $index=>$step) {
        $other=$b['steps'][$index]??[];
        foreach (['status','responseSha256','stableHeadersSha256','beforeSha256','afterSha256'] as $key) if (($step[$key]??null)!==($other[$key]??null)) $result['exactReplayEqual']=false;
    }
    if (count($a['steps'])!==count($b['steps'])) $result['exactReplayEqual']=false;
}
// No scoped UUID/time/random invariants have independent owner approval yet.
$result['decision']=$all && $result['exactReplayEqual']?'GO':'NO-GO';
$result['rawEvidenceRetention']='ephemeral-container-tmpfs-only';
echo encode($result), PHP_EOL;
