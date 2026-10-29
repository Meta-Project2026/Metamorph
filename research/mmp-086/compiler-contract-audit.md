# Actual generation and compiler contract

Implementation under review: code commit
`b421465307d4dde3101ccbc4309660b5884d297e` based on
`3fb4772ef9c5d2c659530ae75b3076612eb18a3f`. Exact serialized request inspection:
`node research/mmp-086/audit-request.mjs` after `pnpm build`.
The [request audit](evidence/request-audit.json) saves target fields, the exact
developer message, unchanged response schema and hashes, without copying PHP or
candidate bytes. `bindMigrationContext().prompt()` is the owning user-message
encoder; `prepareMetaMigration()` is the owning wire encoder.

## Request and admitted source

The developer asks for translation of the supplied public PHP service, JSON
changes only, no tools/external calls or invented usage/verdicts. The user message
contains the complete pinned api.php (11956 bytes), config.php (4331 bytes), MIT
notice, 11 ordered function units, five actions, target and scope. It carries no
held-out cases, expected outputs, replay implementation or original generated TS.

The JSON Schema requires only `{changes:[{path,content}]}`, 1–64 files, with no
extra fields. Its path is an unconstrained JSON string; the actual writer and
`validateBundle` enforce the stricter policy independently: case-unique ASCII
`src/**/*.ts`, entrypoint `src/main.ts`, <=240 path characters, <=256 KiB/file,
<=1 MiB total, restricted reserved directories, no NUL, links, package.json,
tsconfig, npm scripts or external dependency installation. Missing entrypoint
and disallowed paths are admission failures before compilation, not TS errors.
The response schema remains unchanged in this PR.

One request, no retries/repairs/failovers/tools, Standard muse-spark-1.3,
reasoning_effort=low, max_completion_tokens=16384 (including reasoning), response
<=2 MiB, request <=180s and generation session <=240s. Message text <=128 KiB,
serialized request <=160 KiB. The 65536 input-token field is a post-response
usage acceptance bound; it is not an exact pre-send tokenizer count.

## Pinned compiler and runtime

`packages/target-worker/runtime/build.mjs` writes admitted source in `/work` and
executes `/usr/local/bin/node /opt/toolchain/node_modules/typescript/lib/tsc.js`
with:

```text
--target ES2022 --module NodeNext --moduleResolution NodeNext
--strict --noEmitOnError --skipLibCheck false
--rootDir /work/src --outDir /work/out
--typeRoots /opt/toolchain/node_modules/@types /work/src/<each admitted file>
```

The first phase also supplies `--noEmit`; build runs only after typecheck exits
zero. There is no candidate tsconfig/package.json and no requested TSC version
resolution. Each compiler phase has a 12s timeout and 512 KiB maxBuffer; the
controller gives Docker build 35s within the unchanged 180s worker lifetime.
Nonzero compiler status produces FAIL; compiler process/environment faults produce
ERROR, not a guessed TS code. Formatting is plain in this non-TTY invocation;
the recipe does not explicitly set `--pretty false`. The matrix checks its
actual output, not a synthetic formatter approximation.

TypeScript 5.9.3 and @types/node 22.20.5 are exact runtime package/lockfile pins.
The base is Node 24.11.0, SQLite 3.50.4. NodeNext interprets admitted .ts as
CommonJS because `/work` has no package.json. TS import/export syntax can compile
to require; top-level await and import.meta are rejected. `.js` relative imports
resolve TS siblings and match emitted JS. Bare external packages are unavailable.
`node:http`, `node:sqlite`, `node:fs`, `node:url`, etc. use the installed Node
declarations. There is no compiler allowlist that makes *every* Node builtin
safe to use: imports are not a permission grant. Runtime process/filesystem
restrictions and network-off Docker still apply. Runtime-24 API availability
does not imply it is declared in the pinned Node-22 types.

`node:sqlite` is declared and used by the existing positive fixture. Its get()
returns `Record<string,SQLOutputValue> | undefined`; all() returns an array of
records. SQLOutputValue includes string, number, bigint, Uint8Array and null.
An assumed numeric/string record or an unguarded optional row can fail strict
typing. These are code-backed hypotheses about model behavior, not recovered
historical compiler evidence.

`launch.mjs` starts `/work/out/main.js` without a shell or package manager, with
Node permissions allowing only `/work/out` reads and `/state` reads/writes.
Application env configuration is absent; fixed PATH/TZ and clock env are trusted
runtime settings. The service must listen on loopback port 3000, implement the
original `/api.php?action=...` routes and form handling, create/seed the SQLite
schema at `/state/target.sqlite`, and process state changes. G1 compilation alone
does not prove any of that. Independent initial-state and public HTTP/DB
comparisons retain their existing role. The workshop state tmpfs is bounded to
16 MiB; resets create fresh independent candidate/reference state. No imports or
normalization are widened by this patch.

## Minimal patch and measurable consequences

The existing prompt said "strict ES2022 NodeNext; no package.json" but left the
resulting CommonJS interpretation implicit. It did not name @types/node or the
SQLite result union. The patch adds 805 serialized request bytes (+3.67%) and
names only these compiler/startup facts. It does not feed compiler diagnostic
controls or fixture answers to the model. TS1309/TS1470/TS7006/TS2307 and SQLite
assignment controls provide falsifiable examples; the existing full fixture
checks a compatible multi-file HTTP/SQLite service through the same validator.

Old request SHA256:
`cffae52f598014894c6d619fa17a9f146c933656430913b2af3a368df6a7120c`;
new request SHA256:
`55c7b8442814b6dfb3a273d45063553ea00e4466046945fd72fd7ea2f38d5d5d`.
Old/new request bytes: 21957 / 22762. Old projection $0.220377; new projection
$0.224402. New context SHA256:
`21415d8b4ea38ad0bfcab92c3632777e30e36a8e3c74b17d95ec9abef8a5c345`.
The change invalidates the old reviewed request identity. No entitlement check,
provider acceptance, model correctness or second paid authorization is inferred.
