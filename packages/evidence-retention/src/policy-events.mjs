import {
  check,
  DAY,
  DAY90_WINDOW_START,
  digest,
  equal,
  id,
  timestamp,
} from "./core.mjs";
import { authenticated, keyId, verifyCatalogWitness } from "./crypto.mjs";

export const PRIVILEGED = new Set([
  "RETENTION_POLICY",
  "RESTORE_RECEIPT",
  "HOLD_RELEASE",
  "DELETION_AUTHORIZED",
  "DELETION_VERIFIED",
  "GRANT_REVOKED",
  "RESTORE_VERIFIED",
]);
export function policyContext(options) {
  const {
    witness,
    storageWitness,
    trust,
    readerPublicKey,
    ownerPublicKeys,
    reviewerPublicKey,
    deletionWitnessKeys = null,
  } = options;
  const f = verifyCatalogWitness(
    witness,
    trust.witnessPublicKey,
    trust.witnessSha256,
  );
  const s = authenticated(
    storageWitness,
    trust.witnessPublicKey,
    trust.storageWitnessSha256,
  );
  check(s.catalogWitnessSha256 === trust.witnessSha256, "POLICY_SCOPE");
  return {
    format: "mmp-policy-context-v1",
    identity: f.catalog.identity,
    witnessSha256: trust.witnessSha256,
    storageWitnessSha256: trust.storageWitnessSha256,
    manifestSha256: f.manifestSha256,
    packCount: f.catalog.packs.length,
    fileCount: f.catalog.packs.reduce((n, p) => n + p.files.length, 0),
    versions: s.versions,
    recipients: f.recipients.map(({ principal }) => principal),
    terminal: timestamp(f.catalog.identity.terminalReceiptAt),
    due:
      Math.min(
        ...f.catalog.attempts.map((a) => timestamp(a.terminalReceiptAt)),
      ) +
      90 * DAY,
    windowStart:
      timestamp(f.catalog.identity.terminalReceiptAt) +
      DAY90_WINDOW_START * DAY,
    readerPublicKey,
    ownerPublicKeys,
    reviewerPublicKey,
    deletionWitnessKeys,
    authorityPublicKey: trust.witnessPublicKey,
  };
}
export function validateRestore(c, record, at) {
  const p = authenticated(record, c.readerPublicKey, digest(record));
  const expected = c.versions
    .filter((v) => v.domainId === p.domainId)
    .map((v) => v.versionId)
    .sort();
  check(
    p.purpose !== "DAY90" || timestamp(p.at) >= c.windowStart,
    "DAY90_WINDOW",
  );
  check(
    p.format === "mmp-evidence-restore-v1" &&
      p.status === "SIMULATED_RESTORED" &&
      p.witnessSha256 === c.witnessSha256 &&
      p.storageWitnessSha256 === c.storageWitnessSha256 &&
      p.manifestSha256 === c.manifestSha256 &&
      p.identitySha256 === digest(c.identity) &&
      c.recipients.includes(p.principal) &&
      p.packCount === c.packCount &&
      p.fileCount === c.fileCount &&
      expected.length > 0 &&
      Array.isArray(p.versions) &&
      equal([...p.versions].sort(), expected) &&
      ["IMMEDIATE", "DAY90"].includes(p.purpose) &&
      timestamp(p.at) >= c.terminal &&
      timestamp(p.at) <= timestamp(at),
    "RESTORE_RECEIPT",
  );
  return p;
}
export function owners(c, records, action, at, extra = {}) {
  check(
    Array.isArray(records) &&
      records.length === 2 &&
      keyId(c.ownerPublicKeys[0]) !== keyId(c.ownerPublicKeys[1]),
    "TWO_OWNERS_REQUIRED",
  );
  records.forEach((r, i) => {
    check(
      equal(authenticated(r, c.ownerPublicKeys[i], digest(r)), {
        format: "mmp-evidence-owner-action-v1",
        action,
        witnessRef: c.identity.witnessRef,
        at,
        witnessSha256: c.witnessSha256,
        storageWitnessSha256: c.storageWitnessSha256,
        ...extra,
      }),
      "OWNER_AUTHORIZATION",
    );
  });
}
export function reduced(c, rows) {
  const holds = new Set(),
    immediate = new Set(),
    day90 = new Set(),
    revoked = new Set();
  let incident = false;
  for (const { payload: p } of rows) {
    if (p.type === "HOLD_ADD") holds.add(p.holdId);
    if (p.type === "HOLD_RELEASE") holds.delete(p.holdId);
    if (p.type === "INCIDENT") incident = true;
    if (p.type === "GRANT_REVOKED") revoked.add(p.grantId);
    if (p.type === "RESTORE_RECEIPT") {
      if (p.purpose === "IMMEDIATE") immediate.add(p.domainId);
      if (
        p.purpose === "DAY90" &&
        timestamp(p.restoredAt) >= c.windowStart &&
        timestamp(p.restoredAt) <= c.due
      )
        day90.add(p.domainId);
    }
  }
  return { holds, immediate, day90, revoked, incident };
}
export function eventValidator(c) {
  return (p, at, previous) => {
    if (!PRIVILEGED.has(p.type)) return;
    check(p.type !== "RESTORE_VERIFIED" && p.authorization, "EVENT_AUTHORITY");
    const { authorization, ...body } = p;
    const checkpoint = {
      format: "mmp-evidence-journal-checkpoint-v1",
      count: previous.length,
      sha256: previous.length ? digest(previous.at(-1)) : "0".repeat(64),
    };
    check(
      equal(
        authenticated(
          authorization,
          c.authorityPublicKey,
          digest(authorization),
        ),
        {
          format: "mmp-policy-event-v1",
          contextSha256: digest(c),
          previous: checkpoint,
          at,
          payloadSha256: digest(body),
        },
      ),
      "EVENT_AUTHORITY",
    );
    if (p.type === "RESTORE_RECEIPT") {
      const r = validateRestore(c, p.record, at);
      check(
        p.receiptSha256 === digest(p.record) &&
          p.domainId === r.domainId &&
          p.purpose === r.purpose &&
          p.restoredAt === r.at &&
          !previous.some((x) => x.payload.receiptSha256 === p.receiptSha256),
        "EVENT_RESTORE",
      );
    }
    if (p.type === "HOLD_RELEASE") {
      owners(c, p.approvals, "RELEASE_HOLD", at, { holdId: p.holdId });
      check(reduced(c, previous).holds.has(p.holdId), "HOLD");
    }
    if (p.type === "GRANT_REVOKED") id(p.grantId);
    if (p.type === "DELETION_AUTHORIZED") {
      owners(c, p.approvals, "DELETE", at);
      check(
        equal(
          authenticated(
            p.reviewRecord,
            c.reviewerPublicKey,
            digest(p.reviewRecord),
          ),
          {
            format: "mmp-evidence-no-hold-v1",
            witnessRef: c.identity.witnessRef,
            at,
            noHold: true,
            witnessSha256: c.witnessSha256,
            storageWitnessSha256: c.storageWitnessSha256,
          },
        ),
        "REVIEW_AUTHORIZATION",
      );
      const state = reduced(c, previous);
      check(
        !state.holds.size &&
          !state.incident &&
          state.day90.size === 2 &&
          timestamp(at) >= c.terminal + 180 * DAY &&
          p.planSha256 === digest(p.plan) &&
          p.plan.at === at &&
          p.plan.witnessSha256 === c.witnessSha256 &&
          p.plan.storageWitnessSha256 === c.storageWitnessSha256,
        "DELETION_HELD",
      );
    }
    if (p.type === "DELETION_VERIFIED") {
      const state = reduced(c, previous);
      const last = previous.at(-1)?.payload;
      const { journalCheckpoint, ...body } = p.plan;
      check(
        last?.type === "DELETION_AUTHORIZED" &&
          last.planSha256 === digest(body) &&
          equal(journalCheckpoint, checkpoint) &&
          !state.holds.size &&
          !state.incident,
        "DELETION_UNVERIFIED",
      );
      check(
        c.deletionWitnessKeys && p.receipts?.length === p.plan.targets.length,
        "DELETION_UNVERIFIED",
      );
      p.receipts.forEach((r, i) => {
        check(
          equal(
            authenticated(
              r,
              c.deletionWitnessKeys[p.plan.targets[i]],
              digest(r),
            ),
            {
              format: "mmp-evidence-deletion-witness-v1",
              target: p.plan.targets[i],
              planSha256: digest(p.plan),
              status: "SYNTHETIC_DELETED_OR_ABSENT",
              at,
            },
          ),
          "DELETION_UNVERIFIED",
        );
      });
    }
    if (p.type === "RETENTION_POLICY")
      check(
        previous.length === 0 &&
          p.witnessSha256 === c.witnessSha256 &&
          p.storageWitnessSha256 === c.storageWitnessSha256 &&
          p.contextSha256 === digest(c) &&
          p.day90DueAt === new Date(c.due).toISOString() &&
          p.minimumRetainUntil ===
            new Date(c.terminal + 180 * DAY).toISOString(),
        "POLICY_CHANGED",
      );
  };
}
