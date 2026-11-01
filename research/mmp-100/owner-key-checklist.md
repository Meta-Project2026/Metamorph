# Owner-local harmless challenge — instructions only

**OWNER_DECRYPT_NOT_VERIFIED. The agent has not executed these commands.**
The private identity stays on the owner's own device. Do not provide its path,
file, contents, backup, screenshot or terminal dump to any agent, GitHub or CI.
Only the owner can execute this local test. The procedure reproduces the
[existing MMP094 challenge](../mmp-094/owner-key-roundtrip.md).

Expected public recipient:
`age1yvf40njrznnr7emg5j76azu62579z38gzh2jqss72l2u9308n5essrvy6f`.
Expected SHA256 of the harmless UTF-8/no-BOM/LF47-byte text:
`96059327050fce6727821c30e5c58b44ba4ee391693fe2ad7bf44589f3274746`.
Production encryptor is pinned to agev1.3.2. Use a trusted local age installation
and report its observed version; any different version needs explicit review,
not a production-pin change.

In the owner's own PowerShell, set the identity path **locally only**, then run:

```powershell
$identityPath = '<owner-chosen local identity path; never report this value>'
$recipient = 'age1yvf40njrznnr7emg5j76azu62579z38gzh2jqss72l2u9308n5essrvy6f'
$expected = '96059327050fce6727821c30e5c58b44ba4ee391693fe2ad7bf44589f3274746'
$ageVersion = (& age --version 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw 'FAIL: age version unavailable' }
$derived = & age-keygen -y $identityPath
if ($LASTEXITCODE -ne 0 -or ($derived -join "`n").Trim() -cne $recipient) {
    throw 'FAIL: public recipient mismatch'
}
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('mmp100-public-' + [guid]::NewGuid().ToString('N'))
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
    & age -d -i $identityPath -o $decoded $cipher
    if ($LASTEXITCODE -ne 0) { throw 'FAIL: decryption' }
    if ((Get-FileHash -LiteralPath $decoded -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expected) {
        throw 'FAIL: roundtrip digest'
    }
    [pscustomobject]@{result='PASS';publicRecipient=$recipient;publicTextSha256=$expected;ageVersion=$ageVersion}
} finally {
    foreach ($testFile in @($plain,$cipher,$decoded)) {
        if (Test-Path -LiteralPath $testFile) { Remove-Item -LiteralPath $testFile -Force }
    }
    if (Test-Path -LiteralPath $testRoot) { Remove-Item -LiteralPath $testRoot }
}
```

Report **only** PASS/FAIL, the public recipient, public challenge SHA and age
version. On failure, report FAIL with those public fields if available; omit
raw age output and all private local details. Never upload even the test
ciphertext or decoded file. Use decoded bytes only after age exits0; a failed
streaming decrypt can leave partial unauthenticated output. Temporary-file
deletion does not claim secure erase.

An owner-reported policy approval or another throwaway key test is not this
cryptographic observation. A valid owner PASS can close only the owner-key
readiness gate after review. It cannot authorize spending, prove live artifact
upload, reproduce the historical missing candidate or establish product PASS.
