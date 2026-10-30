# Локальная проверка владельца — только безвредный публичный текст

Состояние: **OWNER_DECRYPT_NOT_VERIFIED**. Эта инструкция не выполнялась агентом.
Приватный identity остаётся только на устройстве владельца. Не присылайте его,
файл ключа, его содержимое, реальные расшифрованные исходники или screenshots
терминала с секретами. Не запускайте эти команды в CI.

В локальном PowerShell владельца сначала проверьте публичный recipient:

```powershell
$recipient = 'age1yvf40njrznnr7emg5j76azu62579z38gzh2jqss72l2u9308n5essrvy6f'
$derived = & age-keygen -y "$env:USERPROFILE\.age\keys.txt"
if ($LASTEXITCODE -ne 0 -or ($derived -join "`n").Trim() -cne $recipient) {
    throw 'FAIL: public recipient mismatch'
}
```

Затем в том же локальном окне выполните безвредный challenge. Он создаёт три
новых тестовых файла, не изменяет ключ и не читает реальные artifacts:

```powershell
$ageVersion = (& age --version 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw 'FAIL: age version unavailable' }
$expected = '96059327050fce6727821c30e5c58b44ba4ee391693fe2ad7bf44589f3274746'
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('mmp094-public-' + [guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($testRoot) | Out-Null
$plain = Join-Path $testRoot 'challenge.txt'
$cipher = Join-Path $testRoot 'challenge.age'
$decoded = Join-Path $testRoot 'decoded.txt'
try {
    [IO.File]::WriteAllBytes($plain, [Text.Encoding]::UTF8.GetBytes("MMP-094 public harmless owner age roundtrip v1`n"))
    if ((Get-FileHash -LiteralPath $plain -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expected) {
        throw 'FAIL: public challenge digest'
    }
    & age -r $recipient -o $cipher $plain
    if ($LASTEXITCODE -ne 0) { throw 'FAIL: encryption' }
    & age -d -i "$env:USERPROFILE\.age\keys.txt" -o $decoded $cipher
    if ($LASTEXITCODE -ne 0) { throw 'FAIL: decryption' }
    if ((Get-FileHash -LiteralPath $decoded -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expected) {
        throw 'FAIL: roundtrip digest'
    }
    [pscustomobject]@{result='PASS';publicTextSha256=$expected;ageVersion=$ageVersion;publicRecipient=$recipient}
} finally {
    # Only these three known test files and their unique directory; no recursive delete.
    foreach ($testFile in @($plain,$cipher,$decoded)) {
        if (Test-Path -LiteralPath $testFile) { Remove-Item -LiteralPath $testFile -Force }
    }
    if (Test-Path -LiteralPath $testRoot) { Remove-Item -LiteralPath $testRoot }
}
```

Сообщите только PASS/FAIL, SHA256 **публичного тестового текста**, версию age и
публичный recipient. При FAIL не присылайте сырой вывод расшифровки или ключ.
Челлендж описан в [безопасном JSON](evidence/owner-challenge.json): UTF-8 без BOM,
LF, 47 bytes. Удаление временных файлов не означает гарантированный secure erase.

Roundtrip не разрешает платный запуск. Для реального ciphertext сначала
проверяются точные trusted run/head/source/candidate/attempt/pair и digest, затем
успешная расшифровка и все manifest hashes по [существующему runbook](../mmp-089/RUNBOOK.md).
Нельзя выполнять восстановленный кандидат на хосте. Отказ age может оставить
частичный неаутентифицированный вывод; его нельзя использовать.
