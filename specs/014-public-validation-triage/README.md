# MMP-044: independent public validation triage

Refs [#44](https://github.com/Meta-Project2026/Metamorph/issues/44).
Base: `5de7a3315a8b728ee2baa6ed0c97acfc781dc641` (current `origin/main`
after fetch on 2026-10-28). Constitution: **PROPOSED / PENDING OWNER RATIFICATION**.

Result: **NOT_ESTABLISHED / static-only / DOCKER_NOT_RUN**. The public source
suggests two potentially different language rules. No real PHP/TS observation
was collected, so neither candidate behavior nor evaluator error is confirmed.

The bounded preregistration is [cases.public.json](cases.public.json):
14 independently authored public scenarios, 38 requests, 38 planned HTTP and
52 planned SQLite comparisons (14 initial plus 38 post-step). These are plans,
not executed comparison counts. Every scenario is designated
`PUBLIC_INDEPENDENT_REPRO`; none is held-out or formal G4 evidence.

## Scope and information boundary

Only public upstream source, accepted main code and Issue #44 structural metadata
were used. The Issue's validation family, public difference codes and AUDIT_FAIL
are context, not training signals. No PR #31 code, generator, private sample,
seed, pack, raw log, artifact ZIP or local audit directory was read or executed.
No model/provider API call was made. This task uses the current coding agent;
there is no claim of a separate model runtime or independent ChatGPT review.

Allowed changes are confined to this directory and `research/mmp-044/`.
Source, candidate, MANIFEST, normalization, compare functions, workers, Docker
policies, workflows and shared APIs are unchanged. The prior private AUDIT_FAIL
is unchanged. No teammate approval, benchmark registration or product acceptance
is implied.

## Frozen identities

The full file SHA-256 inventory is [pins.json](pins.json). File hashes refer to
canonical Git blob bytes, separately from Windows checkout byte differences.

| Public object | Identity |
| --- | --- |
| Upstream PHP commit | `d272170d0aecbd28eb5b13e272d9dd11d545b66c` |
| PHP archive SHA-256 | `32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4` |
| Upstream MIT LICENSE SHA-256 | `46ef5fb6b330816e097c9e7e16e5a4e6ba8f03c2113a4d97fe8c358f64d629a9` |
| Accepted TS admission bundle SHA-256 | `34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334` |
| MANIFEST canonical JSON SHA-256 | `d800a9a5e874545040438d4dce822da6e0d6b71fb094bcac7f06a6ad05610fd4` |
| Normalization | `oracle-exact-v1`; HTTP/SQLite source hashes in pins.json |
| Canonical target runtime recipe SHA-256 | `f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3` |

No new image ID or measured runtime version is available. The source recipe
expects PHP 7.4.33 / SQLite 3.34.1 and Node 24.11.0 / SQLite 3.50.4 / TS 5.9.3.
PHP base image is pinned in SOURCE; Node base digest is in the pinned Dockerfile.
These are configured identities, not a measurement from this investigation.

## Reproduce the completed static work

From the repository root with Node 22 or 24, pnpm 11.25.0 and Python 3:

```sh
pnpm install --frozen-lockfile
pnpm build
python research/mmp-044/public_source.py
node research/mmp-044/validate.mjs
```

The Python reader downloads the pinned public archive, verifies its digest and
the three exact named members, and reads them in memory. It neither extracts
files onto the host nor executes upstream code. The Node checker checks public
case admission, immutable identities and four original synthetic comparator
controls. It does not import, compile or execute either application. Exit 0
means these static checks passed, never PHP/TS parity or product PASS.

See [hypotheses.md](hypotheses.md) for source-derived rules and preregistration,
[results.md](results.md) for actual checks, [decision.md](decision.md) for the
classification, and [docker-handoff.md](docker-handoff.md) for the unexecuted
low-level transport experiment. No Docker driver or CI workflow is added.

## Sources and provenance

- Root [AGENTS.md](../../AGENTS.md), [README](../../README.md),
  [constitution](../../.specify/memory/constitution.md), and the spec/plan/tasks
  bundles for [011](../011-workshop-target/) and [012](../012-agent-real-composition/).
- Public metadata: [Issue #44](https://github.com/Meta-Project2026/Metamorph/issues/44).
  Its linked private audit artifacts and jobs were not followed.
- Pinned upstream [api.php](https://github.com/tanjilaafsarirubina/car-workshop/blob/d272170d0aecbd28eb5b13e272d9dd11d545b66c/api.php),
  [config.php](https://github.com/tanjilaafsarirubina/car-workshop/blob/d272170d0aecbd28eb5b13e272d9dd11d545b66c/config.php),
  [MIT LICENSE](https://github.com/tanjilaafsarirubina/car-workshop/blob/d272170d0aecbd28eb5b13e272d9dd11d545b66c/LICENSE).
  Archive and license hashes were independently checked. No upstream source was vendored.
- Accepted [TS application](../../packages/target-worker/fixtures/workshop/src/main.ts),
  [schema and retained notice](../../packages/target-worker/fixtures/workshop/src/schema.ts),
  [request policy](../../packages/target-worker/runtime/profile.mjs), and pinned
  Oracle/worker/differential paths listed in pins.json.
- Language semantics references: [PHP integer conversion](https://www.php.net/manual/en/language.types.integer.php),
  [PHP numeric strings](https://www.php.net/manual/en/language.types.numeric-strings.php),
  [PCRE2 character classes](https://pcre.org/current/doc/html/pcre2pattern.html),
  [ECMAScript parseInt](https://tc39.es/ecma262/2022/multipage/global-object.html#sec-parseint-string-radix).
  Current manuals support hypotheses; they do not replace measuring the pinned runtime.

The cases, research scripts and documents are original task-time work by the
coding assistant. Existing dependencies and notices are retained unchanged.
