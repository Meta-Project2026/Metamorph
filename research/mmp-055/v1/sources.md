# Primary sources and provenance

Inspected 2026-10-28 UTC (local delivery 2026-10-29). No prices/cloud entitlement
or current physical deployment inferred.

- [Node 22 crypto](https://nodejs.org/docs/latest-v22.x/api/crypto.html): GCM AAD,
  tags, randomBytes, RSA OAEP SHA-256, Ed25519 sign/verify and OpenSSL implementation.
- [Node 22 filesystem](https://nodejs.org/docs/latest-v22.x/api/fs.html): exclusive
  no-follow opens, fstat, bounded reads, hard links and fsync. Linux procfs is an
  explicit implementation dependency, not portable Windows ACL support.
- [NIST SP 800-38D](https://csrc.nist.gov/pubs/sp/800/38/d/final): authenticated GCM
  and nonce requirements. Its pending revision is not a claim of certification.
- [RFC 8017](https://www.rfc-editor.org/rfc/rfc8017): RSA-OAEP wrapping.
- [Node v22.23.1 license/notices](https://github.com/nodejs/node/blob/v22.23.1/LICENSE):
  Node MIT plus bundled third-party notices. Retain the complete distribution
  notices; this project does not redistribute stripped runtime binaries.
- [OpenSSL 3.5.7 license](https://github.com/openssl/openssl/blob/openssl-3.5.7/LICENSE.txt):
  Apache-2.0. Node/OpenSSL are existing platform dependencies; no new cryptography
  npm dependency, copied cipher implementation or lost upstream notice.

Original package and test code for this issue is separate from untouched Oracle,
comparators, controls, public MANIFEST and existing fixtures. Synthetic SQLite
adapters maintain separate actual databases and compare public requests; no real
PHP/candidate code or hidden historical raw evidence is read/executed.

Owning repository facts inspected directly at base `cb707bb3481ec115460b26ca0da4356a1b47a3ad`:
[Issue #55](https://github.com/Meta-Project2026/Metamorph/issues/55),
[#38](https://github.com/Meta-Project2026/Metamorph/issues/38),
[#52](https://github.com/Meta-Project2026/Metamorph/issues/52),
[#26](https://github.com/Meta-Project2026/Metamorph/issues/26),
[merged #59](https://github.com/Meta-Project2026/Metamorph/pull/59),
[#54](https://github.com/Meta-Project2026/Metamorph/issues/54),
[merged #62](https://github.com/Meta-Project2026/Metamorph/pull/62),
[#56](https://github.com/Meta-Project2026/Metamorph/issues/56), root AGENTS/README/
draft constitution, specs/017-formal-g4 and specs/018-mmp026-evidence-retention.
Merged public Docker proof is execution evidence, never durable private custody.
