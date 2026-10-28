# MMP-054 local validation — 2026-10-28

**Implementation delivered; real offline proof NOT_RUN.** This record is written
by the implementer. Independent ChatGPT review and product acceptance are not
established by it. Machine-readable results, tested script digests and protected
file comparisons are in [validation.json](validation.json).

Branch: `feat/mmp-054-offline-local-proof`. Exact fetched base:
`bcf8275cb2673abbda7a340e25f8c8d5b01198bb`. All changes are additive under
`research/mmp-054/`. Tests ran on this implementation as an uncommitted addition
to that base; the JSON records every tested `.mjs` digest, avoiding a circular
claim that a receipt existed in the commit which contains it. Git delivery binds
the resulting committed scripts to those same bytes.

| Executed command | Exit | Observation |
| --- | ---: | --- |
| `git fetch origin main` | 0 | Main advanced from issuance baseline to the exact base above |
| `pnpm install --frozen-lockfile` | 0 | 54 packages; pnpm 11.25.0 |
| `pnpm lint` | 0 | 137 files |
| `pnpm typecheck` | 0 | Workspace build and all package typechecks |
| `pnpm test` | 0 | 148/148 host synthetic/contract/unit tests |
| `pnpm build` | 0 | All workspace package builds |
| `node --test research/mmp-049/driver.test.mjs` | 0 | 13/13 |
| `node research/mmp-054/check.mjs` | 0 | 9 research scripts, syntax/Biome |
| `node --test research/mmp-054/driver.test.mjs` | 0 | 53/53 final tests |
| `pnpm install --offline --frozen-lockfile` | 0 | Existing prepared **Windows** workspace; dependency tree digest unchanged |
| `node research/mmp-054/run-offline.mjs --run /missing-bundle /missing-output bcf8275cb2673abbda7a340e25f8c8d5b01198bb` | 1 | Expected Windows platform rejection, `OFFLINE_NETWORK_ISOLATION_NOT_PROVEN`; no runtime launched |
| `git diff --cached --check` | 0 | No whitespace errors |

Additional diagnostics included `docker version`, `wsl --list --verbose`, local
Git status/worktree inspection and read-only Issue #54 lookup. Observed environment:
Windows, Node 22.23.1, pnpm 11.25.0; Docker Desktop client/server 29.9.2 with Linux
amd64 daemon; only `docker-desktop` WSL distribution. This does not attest an
offline daemon or a working native Linux namespace recipe.

During test expansion the new fresh-process preload test initially failed with
`ERR_UNSUPPORTED_ESM_URL_SCHEME` because Node on Windows requires a file URL for
an absolute `--import` path. The caller now uses `pathToFileURL`; the final full
53-test run passed. Earlier 49-test and combined 64-test runs passed before that
new test was added; intermediate 52/53-test runs failed only that new test.
No comparator, fixture, policy, expected result or original test was changed.

The full checker regression test consumes the committed **historical public**
MMP-049 run `40720986007` only as a read-only unit fixture. Its synthetic offline
envelope is discarded in the test temporary directory. Those historical online
observations are not MMP-054 execution evidence and are not converted to offline
PASS. No synthetic envelope, source archive, image bundle or raw pack is published.

## Proof classification and missing evidence

| Area | This delivery |
| --- | --- |
| CLI/adapters/receipt checker | IMPLEMENTED; host tests passed |
| Linux amd64 online preparation and cache export | NOT_RUN |
| Complete host + daemon outbound isolation | OFFLINE_NETWORK_ISOLATION_NOT_PROVEN |
| Real host/daemon/eight-role network-denial controls | NOT_RUN |
| Real public PHP↔TS schedule under isolation | OFFLINE_PROOF_NOT_RUN; observed coverage 0 pairs/0 HTTP/0 SQLite |
| Real deterministic Agent repair under isolation | NOT_RUN; observed fresh pairs 0 |
| Independent runtime finalizer/resource accounting | NOT_RUN; unknown inventory is not recorded as zero |
| Local LLM generation | LOCAL_LLM_GENERATION_NOT_RUN |
| Remote AI/private audit | NOT_RUN; paid calls 0 |
| G0/formal private G4 | INCONCLUSIVE |
| Product | NOT_ESTABLISHED |
| Hosted Fast CI | Reported separately in PR checks; not offline evidence |

Smallest missing experiment: separately authorize and run the documented online
preparation at the exact PR code SHA, then execute on Linux amd64 with a **new
native Docker/containerd inside the same network-denied context** (or a detached
VM). Record actual host/daemon/worker negative controls, all unchanged public
requests and initial/post-step state, deterministic two-attempt repair, exact
source/image identities and independent normal-cleanup receipts. Verify the five
allowlisted public files before reconnecting/publishing. Windows/WSL2 and native
Linux recipes both remain documented-only until that experiment actually runs.

The original target lifetime policy remains 180000 ms. This wrapper reuses
prepared toolchain images and rebuilds candidate code in the real worker; it
does not claim offline apt/npm image construction. The same installed checkout,
absolute tool/store paths and compiled artifacts must be retained. Strict
fingerprints may reject any legitimate package-store metadata drift; do not
ignore that failure or reprepare silently. Daemon storage quota and clean
privileged execution context are operator prerequisites, not tested guarantees.
Cancellation, disk-pressure behavior, namespace startup, archive reload and
all-path cleanup still need real Linux validation. Existing #26/#34 limitations
are preserved; no cleanup internals were repaired here.

## Protected surfaces and publication

All six named protected files, cleanup internals and their identified callers
remain unchanged. The
JSON compares eleven owning files byte-for-byte against the base SHA, including
Oracle runner, private runner, worker controller/smoke, parity workflow,
workshop regressions, resource/finalizer implementations and Agent runtime.
All tracked changes outside the additive research directory are empty.

Candidate identities remain distinct: frozen baseline
`34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334`;
`workshop-compat-v1`
`5fe43bb1b0e2147fb85d1c0074678e5823fb07c45cbd7d90c1bdee030b24d928`.
Original fixtures, corpus, MANIFEST, clock, profiles, receipts and Docker proof
classifications are unchanged.

The publication scan checks known API/GitHub/AWS key and private-key patterns in
the new source/docs/JSON. No matches were observed (`rg` exit 1 means no matches).
This is a targeted pattern scan, not proof against every possible secret format.
Only implementation and local-validation metadata are committed. No private
data, credentials, hidden input, model weight or raw runtime pack was accessed
or published. No issue closure, self-merge or owner approval is implied.
