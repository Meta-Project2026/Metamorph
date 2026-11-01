# Candidate custody threat model

## Overview

Scope: fresh offline review of custody paths at
`c3f697b4fcbd5ca9162ff47e0659659e07a1defc`, plus the proposed contract and inert prototype.
No real candidate, hidden corpus, provider API, Docker or owner key was inspected/executed.
This is a design threat model, not a vulnerability scan or implementation security approval.
A separate fresh-context read-only architecture pass was checked against baseline source.

| Component / asset                     | Configured behavior and evidence                                                                                                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generation adapter / original bytes   | Shape validation and restricted writer; frozen source lease then provider-receipt candidateSha equality before GENERATED (`packages/agent-real/src/source.mjs:35`, `packages/agent-real/src/migration-trial.mjs:86`)      |
| Generation transfer / private staging | Original TS and private transfer path remain on trusted runner; fresh validator re-admits/copies; not a durable archive (`research/mmp-078/paid-run.mjs:25`, `packages/agent-real/src/migration-trial.mjs:142`)           |
| Verifier / source packs               | Later attemptId UUID; per-pair candidate source recorded privately before worker provisioning (`packages/agent-real/src/runtime.mjs:371`, `packages/agent-real/src/runtime.mjs:525`)                                      |
| Existing selector                     | G1 FAIL diagnostic branch or complete G1 PASS plus finished G2/G3 and full bindings; partial/error excluded before collection (`packages/agent-real/src/candidate-retention.mjs:125`, `research/mmp-089/preserve.mjs:43`) |
| Ciphertext / owner decryption         | Fixed public recipient and qualified tools; network-off narrow encryptor with memory/stdin plaintext (`packages/agent-real/src/private-diagnostics.mjs:16`, `packages/agent-real/src/encrypt-diagnostics.mjs:65`)         |
| Upload / public receipts              | Fresh binding, normal cleanup and independent finalizer, ciphertext hash/length; upload outcome separately records PRESERVED (`research/mmp-089/prepare-upload.mjs:8`, `research/mmp-089/record-upload.mjs:10`)           |

| Effective resource / configuration chain                             | Access, lifecycle and enforcement                                                                                                                                        |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RUNNER_TEMP → meta-paid-private → restricted source session          | Trusted host UID/root, original candidate plaintext until ephemeral runner destruction; Docker cleanup does not erase source                                             |
| RUNNER_TEMP → meta-paid-verification → attempt/pair private packs    | Mixed source/reference/runtime evidence; selector is trusted host code, not an OS filesystem sandbox                                                                     |
| DIAGNOSTIC_POLICY → pinned age/image → /tool/age + /tool/encrypt.mjs | Encryptor receives selected stdin and two read-only tool mounts; no host roots/socket/credentials/private key (`encrypt-diagnostics.mjs:130`)                            |
| Fixed candidate-diagnostics.age → upload-artifact                    | Exactly one encrypted file, seven-day requested lifetime; public-repository readers can download (`.github/workflows/meta-paid-migration.yml:121`)                       |
| New proposed checkpoint artifact → owner-local copy                  | DECISION_PENDING; fixed candidate.age only. Requires authenticated run/hash retrieval and explicit owner acknowledgment of ciphertext audience; no implementation exists |

## Trust boundaries and assumptions

Provider/model controls generated changes, not host capabilities, trusted UUIDs or
Oracle policy. Candidate execution belongs only in separately authorized disposable
workers. This task executes only original inert research controls. Admission to an
in-memory bundle is distinct from compilation, custody, verification and publication.

Owner/operator→trusted host admission, provider→restricted writer, private source→fresh
collector, mixed packs→candidate-only selection, selector→isolated encryptor, and ciphertext→
uploader/reader are separate boundaries. Credentials belong to the host adapter. A fresh
process alone is insufficient isolation: current preservation explicitly allowlists child
environment (`research/mmp-089/preserve.mjs:14`), while the host retains filesystem/Docker
authority. Prototype issuer methods are synthetic trusted-host capabilities; never hand
them, encryption injection or expected identity constructors to a worker.

Assume trusted repository/workflow/tool pins, host UID/root, Docker/kernel and quiescent
private staging. No protection against an already hostile same-UID/root host is claimed.
Filesystem type/link/ownership/hash/stability checks reduce confused-deputy/race risk;
realpath checks alone cannot prove absence of concurrent namespace replacement. Linux
ownership and confinement acceptance remains separate from Windows functional tests.

The source context is public and pinned; generated text still is not proven secret-free.
Marker rejection cannot detect arbitrary credential encodings or unknown secrets. Public
payloads must be constructed afresh from an exact schema, never spread a raw failure,
worker observation or private pack. The original source and private packs persist until
runner destruction under current policy (`research/mmp-089/spec.md:31`). No secure erasure.

Public recipient knowledge lets anyone create ciphertext. Encryption does not authenticate
the producer: provenance depends on trusted exact-run receipts and authenticated artifact
retrieval. Owner key possession/restore and external service behavior are not established
by source inspection. Readers can retain ciphertext past expiry; later key compromise
can expose past copies. This is not an owner-only GitHub ACL (`research/mmp-089/spec.md:32`).

The user authorizes research only. Both-owner approval of the concrete new contract and
independent review of a separate implementation remain prerequisites. Existing paid policy
and #104 telemetry agreements do not supply either. Historical source is UNAVAILABLE,
root cause UNKNOWN, product PRODUCT_NOT_ESTABLISHED.

## Prioritized attacker stories and required mitigations

These are design hypotheses, not validated vulnerability findings.

| Priority / story                                                                | Consequence                                                                   | Contract mitigation / evidence limit                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High: substitute a different source/run/head/attempt or forge pair build PASS   | Wrong bytes attributed to paid generation; false recovery/acceptance          | Independent six-field expected identity, receipt/admission hash equality, immutable lease, full per-file manifest; custody UUID explicitly distinct from verifier UUID. Prototype checks synthetic identity, not real provider provenance |
| High: path escape, symlink/hardlink, duplicate or TOCTOU supplies private bytes | Confidential host/reference/key material exfiltrated inside encrypted capsule | Restricted paths, no links, bounded fd reads, fd/path/root stability, frozen snapshot, no host execution; host namespace still trusted. Real ownership/isolation acceptance required                                                      |
| High: secret echo or mixed-evidence selection                                   | Owner receives unintended sensitive data; future key compromise exposes it    | Public source-only model context; never provide host credentials; exact new candidate-only envelope and license/scope admission, tripwires, no raw errors/HTTP/SQL/reference/G4/private packs                                             |
| High: hostile accessors/proxies execute during selection                        | Host effects/leak or bypass schema                                            | Reject proxies before reflection; descriptor-only data copy; no getters/coercion; production implementation needs equivalent input admission                                                                                              |
| High: swapped recipient/tool or plaintext fallback                              | Lost decryption or public plaintext                                           | Fixed recipient/tool/image pins, test-key round trip, fail closed before publication, no new plaintext archive. Prototype crypto is not age qualification                                                                                 |
| High: forged cleanup/upload success                                             | Source marked recoverable while missing; resources survive publication        | Distinct trusted checkpoint finalizer/ack, zero normal and independent resources/emergency removals, fixed ciphertext length/hash and retrieval; prototype uses opaque TEST tokens only                                                   |
| Medium: crash/cancel/timeout/late encryption callback                           | Partial archive published or stored status fabricated                         | Atomic commit and sealed state, no retry, no Oracle before durable acknowledgment; prototype proves in-memory sealing only, disk/runner crash persistence NOT_RUN                                                                         |
| Medium: public reader retains ciphertext or private key later leaks             | Expiry cannot revoke; historical plaintext compromised                        | Explicit audience/lifetime consent, owner-local key and copy lifecycle, no revocation claim; encrypted early capture alone is not durable owner-local custody                                                                             |
| Medium: artifact/envelope bomb                                                  | Resource exhaustion or truncation accepted                                    | 64 files, 256 KiB/file, 1 MiB source, 2 MiB encoded/3 MiB ciphertext, bounded depth/entries/deadline; never truncate and declare success                                                                                                  |
| Medium: custody state is mistaken for a gate PASS                               | Paid retry/demo misrepresents product                                         | Always UNVERIFIED, productionAuthority NONE in prototype; untouched G0–G4 aggregation/selectors; genuine AI 6/17/20 evidence and G4 limitations remain separate                                                                           |

## Severity calibration and acceptance limits

High means a plausible future custody implementation could export confidential bytes,
misattribute a candidate, or cause an experiment to proceed without recoverable source.
It requires attacker influence across the named boundary and the missing mitigation;
the table does not claim those failures exist in current production. Same-UID/root control,
repository administrator changes or owner private-key compromise already grant broader
authority and are explicit dependencies rather than new privilege-gain findings.

The concrete research evidence is functional synthetic controls and local test-key
authenticated encryption. It does not prove production age compatibility, host confinement,
crash-safe disk persistence, artifact transport, owner restore or a genuine model result.
Those acceptance tests must pass on the separate exact implementation SHA before paid
readiness; green research CI cannot waive them.
