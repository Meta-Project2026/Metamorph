// Trusted public-source custody contract. Never import or execute candidate text.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { types } from "node:util";
import { MANIFEST_SHA256, SOURCE } from "@metamorph/oracle";
import { strictJson } from "../../differential/src/strict.mjs";
import { sha256, validateBundle } from "../../target-worker/src/admission.mjs";
import { paidAdmission } from "./meta-paid-authorization.mjs";
import { isMigrationContext } from "./migration-context.mjs";
import { DIAGNOSTIC_POLICY, rejectSecrets } from "./private-diagnostics.mjs";
import { isSourceLease } from "./source.mjs";

export const CUSTODY = Object.freeze({
  format: "mmp107-candidate-only-v1",
  receipt: "mmp115-custody-v1",
  plaintext: 2 * 1024 * 1024,
  ciphertext: 3 * 1024 * 1024,
  deadlineMs: 30000,
});
export const requireCustody = (ok) => {
  if (!ok) throw new Error("CUSTODY_REJECTED");
};
const hash = /^[a-f0-9]{64}$/;
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const bindings = [
  "runId",
  "runAttempt",
  "headSha",
  "sourceSha",
  "candidateSha",
  "attemptId",
];
export function plainData(value) {
  let nodes = 0,
    bytes = 0;
  function copy(v, depth) {
    requireCustody(++nodes < 4096 && depth < 10 && !types.isProxy(v));
    if (typeof v === "string") {
      bytes += Buffer.byteLength(v);
      requireCustody(bytes <= CUSTODY.plaintext);
      return v;
    }
    if (v === null || typeof v === "boolean") return v;
    if (typeof v === "number") {
      requireCustody(Number.isFinite(v));
      return v;
    }
    requireCustody(v && typeof v === "object");
    const array = Array.isArray(v);
    requireCustody(
      Object.getPrototypeOf(v) === (array ? Array.prototype : Object.prototype),
    );
    const descriptors = Object.getOwnPropertyDescriptors(v),
      keys = Reflect.ownKeys(descriptors);
    requireCustody(
      keys.length <= 256 && keys.every((k) => typeof k === "string"),
    );
    if (array)
      requireCustody(
        descriptors.length.value <= 64 &&
          keys.length === descriptors.length.value + 1,
      );
    const result = array ? [] : {};
    for (const key of keys) {
      if (array && key === "length") continue;
      const d = descriptors[key];
      requireCustody(
        Object.hasOwn(d, "value") &&
          d.enumerable &&
          !["__proto__", "constructor"].includes(key),
      );
      if (array)
        requireCustody(
          /^(0|[1-9][0-9]*)$/.test(key) &&
            Number(key) < descriptors.length.value,
        );
      result[key] = copy(d.value, depth + 1);
    }
    return Object.freeze(result);
  }
  return copy(value, 0);
}
export function exact(value, keys) {
  requireCustody(
    value && Object.keys(value).sort().join() === [...keys].sort().join(),
  );
}
export function custodyIdentity(input, expected) {
  const v = plainData(input);
  exact(v, bindings);
  requireCustody(
    typeof v.runId === "string" &&
      /^[1-9][0-9]{0,19}$/.test(v.runId) &&
      v.runAttempt === "1",
  );
  requireCustody(
    typeof v.headSha === "string" &&
      /^[a-f0-9]{40}$/.test(v.headSha) &&
      v.sourceSha === SOURCE.commit &&
      typeof v.candidateSha === "string" &&
      hash.test(v.candidateSha) &&
      typeof v.attemptId === "string" &&
      uuid.test(v.attemptId),
  );
  if (expected)
    for (const key of Object.keys(expected)) {
      requireCustody(bindings.includes(key) && v[key] === expected[key]);
    }
  return v;
}
export const sameIdentity = (a, b) => bindings.every((k) => a[k] === b[k]);
const source = JSON.parse(
  readFileSync(
    new URL("../../../research/mmp-061/public-source.json", import.meta.url),
    "utf8",
  ),
);
requireCustody(sha256(source.license) === SOURCE.licenseSha256);
const license = Object.freeze({
  spdx: "MIT",
  sourceSha: SOURCE.commit,
  archiveSha256: SOURCE.archiveSha256,
  noticeSha256: SOURCE.licenseSha256,
});
export function validateCapsule(input, expected) {
  const v = plainData(input);
  exact(v, [
    "format",
    "verification",
    "attemptKind",
    "identity",
    "admission",
    "license",
    "manifest",
    "files",
  ]);
  requireCustody(
    v.format === CUSTODY.format &&
      v.verification === "UNVERIFIED" &&
      v.attemptKind === "GENERATION_CUSTODY",
  );
  custodyIdentity(v.identity, expected);
  exact(v.admission, [
    "generationAttempt",
    "requestBodySha256",
    "responseSha256",
    "contextSha256",
    "manifestSha256",
  ]);
  requireCustody(
    v.admission.generationAttempt === 1 &&
      [
        v.admission.requestBodySha256,
        v.admission.responseSha256,
        v.admission.contextSha256,
      ].every((s) => typeof s === "string" && hash.test(s)) &&
      v.admission.manifestSha256 === MANIFEST_SHA256,
  );
  requireCustody(JSON.stringify(v.license) === JSON.stringify(license));
  const bundle = validateBundle(v.files, v.identity.candidateSha);
  const manifest = bundle.files.map((f) => ({
    path: f.path,
    bytes: Buffer.byteLength(f.content),
    sha256: sha256(f.content),
  }));
  requireCustody(JSON.stringify(v.manifest) === JSON.stringify(manifest));
  requireCustody(
    bundle.files.some((f) => f.content.includes(source.license.trim())),
  );
  for (const f of bundle.files) {
    rejectSecrets(f.content);
    requireCustody(
      !f.content.includes("<?php") &&
        !/MMP\d+_PRIVATE|REFERENCE_MUST_NEVER_EXPORT|HELD_OUT_SECRET/.test(
          f.content,
        ),
    );
  }
  requireCustody(Buffer.byteLength(JSON.stringify(v)) <= CUSTODY.plaintext);
  return v;
}
const attempts = new WeakMap();
// Only opaque existing paid admission can mint a production attempt before send.
export function beginCustody(context, authorization) {
  requireCustody(isMigrationContext(context));
  const auth = paidAdmission(authorization, context);
  const token = Object.freeze({});
  attempts.set(token, { auth, context, attemptId: randomUUID(), used: false });
  return token;
}
export async function capsuleFromLease(token, lease, receipt) {
  const a = attempts.get(token);
  requireCustody(a && !a.used && isSourceLease(lease));
  a.used = true;
  await lease.assertUnchanged();
  const r = plainData(receipt),
    auth = a.auth;
  requireCustody(
    r.format === "meta-generation-v1" &&
      r.status === "PASS" &&
      r.generationKind === "REAL_INFERENCE" &&
      r.attemptedRequests === 1 &&
      r.attempt === 1 &&
      r.action === "generate" &&
      r.sourceSha === auth.sourceSha &&
      r.contextSha256 === auth.contextSha256 &&
      r.manifestSha256 === auth.manifestSha256 &&
      r.inputSha256 === auth.bodySha256 &&
      r.candidateSha === lease.bundle.candidateSha &&
      typeof r.responseSha256 === "string" &&
      hash.test(r.responseSha256),
  );
  requireCustody(
    r.authorization?.runId === auth.runId &&
      r.authorization?.headSha === auth.headSha &&
      r.authorization?.bodySha256 === auth.bodySha256,
  );
  return validateCapsule({
    format: CUSTODY.format,
    verification: "UNVERIFIED",
    attemptKind: "GENERATION_CUSTODY",
    identity: {
      runId: auth.runId,
      runAttempt: "1",
      headSha: auth.headSha,
      sourceSha: auth.sourceSha,
      candidateSha: lease.bundle.candidateSha,
      attemptId: a.attemptId,
    },
    admission: {
      generationAttempt: 1,
      requestBodySha256: r.inputSha256,
      responseSha256: r.responseSha256,
      contextSha256: r.contextSha256,
      manifestSha256: r.manifestSha256,
    },
    license,
    manifest: lease.bundle.files.map((f) => ({
      path: f.path,
      bytes: Buffer.byteLength(f.content),
      sha256: f.sha256,
    })),
    files: lease.bundle.files,
  });
}
export function receiptFor(
  state,
  identity,
  cipher,
  collectorCleanup = "NOT_RUN",
) {
  requireCustody(
    [
      "CAPTURED_UNVERIFIED",
      "CHECKPOINT_READY_UNVERIFIED",
      "STORED_UNVERIFIED",
      "CAPTURE_FAILED",
      "CHECKPOINT_FAILED",
      "UPLOAD_FAILED",
    ].includes(state),
  );
  return plainData({
    format: CUSTODY.receipt,
    state,
    verification: "UNVERIFIED",
    identity: custodyIdentity(identity),
    recipientFingerprint: DIAGNOSTIC_POLICY.recipientKeySha256,
    ciphertextSha256: cipher.sha256,
    ciphertextBytes: cipher.bytes,
    collectorCleanup,
    storage:
      state === "STORED_UNVERIFIED"
        ? "ACKNOWLEDGED_RETRIEVED"
        : "NOT_ESTABLISHED",
  });
}
export function validateReceipt(input, expected, state) {
  const v = plainData(input);
  exact(v, [
    "format",
    "state",
    "verification",
    "identity",
    "recipientFingerprint",
    "ciphertextSha256",
    "ciphertextBytes",
    "collectorCleanup",
    "storage",
  ]);
  custodyIdentity(v.identity, expected);
  requireCustody(
    v.state === state &&
      hash.test(v.ciphertextSha256) &&
      Number.isSafeInteger(v.ciphertextBytes) &&
      v.ciphertextBytes > 100 &&
      v.ciphertextBytes <= CUSTODY.ciphertext &&
      v.collectorCleanup === "VERIFIED_ZERO_RESOURCES",
  );
  requireCustody(
    JSON.stringify(v) ===
      JSON.stringify(
        receiptFor(
          state,
          v.identity,
          { sha256: v.ciphertextSha256, bytes: v.ciphertextBytes },
          v.collectorCleanup,
        ),
      ),
  );
  return v;
}
export function parseCapsule(bytes, expected) {
  requireCustody(Buffer.isBuffer(bytes) && bytes.length <= CUSTODY.plaintext);
  return validateCapsule(
    strictJson(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      CUSTODY.plaintext,
    ),
    expected,
  );
}
export { license as CUSTODY_LICENSE };
