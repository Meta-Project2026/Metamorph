#!/bin/sh
# Manual isolated bootstrap probe only, never a benchmark GO or product PASS.
set -eu
cd /work
php -v
php -m
php -r 'if (PHP_MAJOR_VERSION !== 7 || PHP_MINOR_VERSION !== 4 || !extension_loaded("pdo_sqlite")) { fwrite(STDERR, "PHP 7.4 + pdo_sqlite required\n"); exit(1); }'
mkdir source
tar -xzf /input/source.tgz -C source --strip-components=1 --no-same-owner --no-same-permissions
cd source
test -f LICENSE
if ! find . -type f -name '*.php' -exec sh -c 'for file do php -l "$file" || exit 1; done' sh '{}' + > /work/php-lint.txt 2>&1; then
  cat /work/php-lint.txt
  exit 1
fi
cat /work/php-lint.txt
case "${1:-}" in
  examsuite)
    php scripts/init_db.php
    # Do not read/copy upstream question answers into model context or logs.
    php scripts/seed_questions.php > /work/seed.log 2>&1
    php -S 127.0.0.1:8080 -t public > /work/server.log 2>&1 &
    ;;
  workshop)
    php -S 127.0.0.1:8080 > /work/server.log 2>&1 &
    ;;
  *) echo 'Expected examsuite or workshop' >&2; exit 2 ;;
esac
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT INT TERM
php -r '$ok=false; for ($i=0;$i<30;$i++) { $s=@fsockopen("127.0.0.1",8080,$e,$m,0.1); if ($s) { fclose($s); $ok=true; break; } usleep(100000); } if (!$ok) exit(1);'
php -r '$ctx=stream_context_create(["http"=>["timeout"=>5,"ignore_errors"=>true]]); $body=file_get_contents("http://127.0.0.1:8080/",false,$ctx); if ($body===false) exit(1); echo json_encode(["scope"=>"bootstrap-only","headers"=>$http_response_header,"bodyBytes"=>strlen($body)]),PHP_EOL; if (!preg_match("~^HTTP/[^ ]+ 200\\b~",$http_response_header[0])) exit(1);'
echo 'BOOTSTRAP_SMOKE_COMPLETED; BUSINESS_REPLAY_NOT_RUN; NO_ORACLE_VERDICT'
