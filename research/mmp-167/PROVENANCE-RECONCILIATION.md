# MMP-167 Recipe Digest Provenance Reconciliation

**Date:** 2026-11-04  
**Base Commit:** `main@5b12e0e815653046151fe5d2e0a437f59eaf64f0`  
**Status:** **RESOLVED / FULLY EXPLAINED WITH MATHEMATICAL PROOF**  

---

## 1. Issue Description

In the qualification results committed from PR #172 ([`research/mmp-167/qualification-results.json`](qualification-results.json)), the recorded digest is:
```json
"runtimeRecipeSha": "bd2296fcbb502f1788bc4eaee6de5c3adc49ec30b712d9caaf5bfc93a52680c3"
```
However, the committed production pin in [`packages/agent-real/src/runtime.mjs`](../../packages/agent-real/src/runtime.mjs) and [`packages/agent-real/src/private-diagnostics.mjs`](../../packages/agent-real/src/private-diagnostics.mjs) is:
```javascript
export const RECIPE_PIN = "f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3";
export const DIAGNOSTIC_POLICY = {
  recipeSha: "f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3",
  ...
};
```
These two hashes differ. An earlier comment claimed "matches RECIPE_PIN" without independent reconciliation.

---

## 2. Independent Digest Calculation

The runtime broker ([`packages/target-worker/src/runtime-broker.mjs`](../../packages/target-worker/src/runtime-broker.mjs)) and validator compute `recipeSha` as follows:
1. Scan `packages/target-worker/runtime/` for files ending in `.mjs` or named `Dockerfile`, `package.json`, `package-lock.json`.
2. Sort file names lexicographically (`Array.sort()`).
3. Compute SHA-256 of each file's binary content.
4. Construct an object `{ [filename]: sha256 }`.
5. Compute `sha256(JSON.stringify(hashes))`.

### Detailed File Hashes: Git Canonical (LF) vs Windows Host Disk (CRLF)

| Runtime File | Git Blob SHA-256 (Canonical LF) | Windows Host Disk SHA-256 | Match? | Root Cause |
|---|---|---|:---:|---|
| `Dockerfile` | `dea37c3264516b8e544b5cbbe513285c6b61c0cb8871616a0038aa85d8db1b76` (568 bytes, LF) | `12e37de8edd51cc27aff69ee67a42a3d5beab7b26a19ecc5b14c8a331258f279` (582 bytes, CRLF) | **NO** | Windows checkout CRLF translation |
| `build.mjs` | `25fa4fa9b91a8f7abaf2d67815ecbe3ab33c75e69ad936fd741374ebee49c6bb` | `25fa4fa9b91a8f7abaf2d67815ecbe3ab33c75e69ad936fd741374ebee49c6bb` | **YES** | Byte-identical (has `*.mjs text eol=lf`) |
| `clock.mjs` | `6778b68119616e3bfc7803228ece2c0df90b0fe49d0b85cd4989f110ad0a6adb` | `6778b68119616e3bfc7803228ece2c0df90b0fe49d0b85cd4989f110ad0a6adb` | **YES** | Byte-identical |
| `inspect.mjs` | `795b27c30381de565602d6e658510ec1fa9e4c261e74d520600c07dbecb69e07` | `795b27c30381de565602d6e658510ec1fa9e4c261e74d520600c07dbecb69e07` | **YES** | Byte-identical |
| `launch.mjs` | `ea5858e91fa62ba62ac9519f6c7bb359a0ae21c9751a244cc1cb010b865e24a3` | `ea5858e91fa62ba62ac9519f6c7bb359a0ae21c9751a244cc1cb010b865e24a3` | **YES** | Byte-identical |
| `package-lock.json` | `af2bc4f0e80a37e8d330d95355e8972a2bd6c75e38f14e0dd36b3c60020396f8` | `af2bc4f0e80a37e8d330d95355e8972a2bd6c75e38f14e0dd36b3c60020396f8` | **YES** | Byte-identical (has `*.json text eol=lf`) |
| `package.json` | `b00017ce23cdecc5cdab15fa0050a80527716cdd86e35819c4c08d24e46ce97d` | `b00017ce23cdecc5cdab15fa0050a80527716cdd86e35819c4c08d24e46ce97d` | **YES** | Byte-identical |
| `profile.mjs` | `b37a7994c3564dc30507c8b13aea5042a3887acd886454ba7c5293316aff7096` | `b37a7994c3564dc30507c8b13aea5042a3887acd886454ba7c5293316aff7096` | **YES** | Byte-identical |
| `provenance.mjs` | `e0a38c0111418956f2b0a8ef14f605462c94272fa8817d445dfba24a523cc506` | `e0a38c0111418956f2b0a8ef14f605462c94272fa8817d445dfba24a523cc506` | **YES** | Byte-identical |
| `quota.mjs` | `2ee9ee285ff1656eee9ed1fda34805e90f9f716d2e2e15016729d65de58a523a` | `2ee9ee285ff1656eee9ed1fda34805e90f9f716d2e2e15016729d65de58a523a` | **YES** | Byte-identical |
| `sqlite-value.mjs` | `f4ed14c4709e275aeb92b7bcdbb8767f2a5ee31701c95a0d182bc276e096de00` | `f4ed14c4709e275aeb92b7bcdbb8767f2a5ee31701c95a0d182bc276e096de00` | **YES** | Byte-identical |
| `unit-smoke.mjs` | `eb8568bf0575d22507924335f05f41ce525e4f005d2504e0d060e9e76fc4259a` | `eb8568bf0575d22507924335f05f41ce525e4f005d2504e0d060e9e76fc4259a` | **YES** | Byte-identical |

### Recipe Hash Result
- **Canonical Git LF bytes:** `f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3` (matches `RECIPE_PIN` exactly).
- **Windows Host Disk bytes:** `bd2296fcbb502f1788bc4eaee6de5c3adc49ec30b712d9caaf5bfc93a52680c3` (matches `qualification-results.json` exactly).

---

## 3. Root Cause Analysis

1. **Why did `Dockerfile` have CRLF on the local host?**
   - The repository root [`.gitattributes`](../../.gitattributes) configured:
     ```gitattributes
     * text=auto
     *.ts text eol=lf
     *.mjs text eol=lf
     *.json text eol=lf
     *.yaml text eol=lf
     *.yml text eol=lf
     *.md text eol=lf
     ```
   - `Dockerfile` does not have a file extension, so it matched `* text=auto`.
   - On a Windows checkout where `core.autocrlf = true`, Git checked out `Dockerfile` with CRLF (`\r\n`).
   - Every `.mjs` and `.json` file matched explicit `text eol=lf` rules and remained LF.
2. **Prior Known Incident:**
   - In [`research/mmp-100/validation.md`](../mmp-100/validation.md), this exact discrepancy was documented:
     > `| validateRuntimeRecipe on local Windows checkout | exit1, ENVIRONMENT_ERROR: Dockerfile CRLF bytes differ from immutable LF Git bytes |`
   - In [`packages/agent-real/test/composition.test.mjs`](../../packages/agent-real/test/composition.test.mjs#L60-L76), unit tests explicitly assert that if `Dockerfile` is mutated with `replaceAll("\n", "\r\n")`, `validateRuntimeRecipe` must throw `ENVIRONMENT_ERROR`.
3. **Conclusion:**
   - The hash `bd2296fcbb502f1788bc4eaee6de5c3adc49ec30b712d9caaf5bfc93a52680c3` recorded in `qualification-results.json` was generated because `measure-live.mjs` was executed on Windows, reading the checked-out CRLF `Dockerfile`.
   - The true canonical production recipe digest is **`f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3`**.
   - On GitHub-hosted Linux (`ubuntu-24.04`), checkouts naturally preserve LF for all files, so `buildTrustedRuntime()` produces `f09b12fe...`.
   - Adding `Dockerfile text eol=lf` to `.gitattributes` eliminates this discrepancy across all operating systems without modifying the canonical Git blob or `RECIPE_PIN`.
