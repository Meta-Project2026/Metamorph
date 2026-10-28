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
import { planBody } from "./deletion.mjs";
import { Journal } from "./journal.mjs";

/** UTC calendar deadlines. The caller of the synthetic simulation can pass a
 * deterministic test time. Real deployment requires a trusted external clock
 * and independently witnessed journal high-water marks; local root can lie. */
export class RetentionLedger {
  constructor({
    journalRoot,
    witness,
    storageWitness,
    trust,
    readerPublicKey,
    ownerPublicKeys,
    reviewerPublicKey,
    deletionWitnessKeys = null,
    now = new Date().toISOString(),
  }) {
    const frozen = verifyCatalogWitness(
      witness,
      trust.witnessPublicKey,
      trust.witnessSha256,
    );
    const storage = authenticated(
      storageWitness,
      trust.witnessPublicKey,
      trust.storageWitnessSha256,
    );
    check(
      storage.format === "mmp-evidence-storage-witness-v1" &&
        storage.catalogWitnessSha256 === trust.witnessSha256,
      "WITNESS_MISMATCH",
    );
    this.identity = frozen.catalog.identity;
    this.trust = trust;
    this.readerPublicKey = readerPublicKey;
    this.ownerPublicKeys = ownerPublicKeys;
    this.reviewerPublicKey = reviewerPublicKey;
    this.deletionWitnessKeys = deletionWitnessKeys;
    this.manifestSha256 = frozen.manifestSha256;
    this.packCount = frozen.catalog.packs.length;
    this.fileCount = frozen.catalog.packs.reduce(
      (n, p) => n + p.files.length,
      0,
    );
    check(
      ownerPublicKeys.length === 2 &&
        keyId(ownerPublicKeys[0]) !== keyId(ownerPublicKeys[1]),
      "TWO_OWNERS_REQUIRED",
    );
    this.versions = storage.versions;
    this.domains = [...new Set(storage.versions.map((r) => r.domainId))].sort();
    check(
      this.domains.length === 2 &&
        storage.versions.length === frozen.catalog.packs.length * 2 &&
        new Set(storage.versions.map((r) => `${r.domainId}/${r.packId}`))
          .size === storage.versions.length,
      "STORAGE_COVERAGE",
    );
    this.terminal = timestamp(this.identity.terminalReceiptAt);
    this.due =
      Math.min(
        ...frozen.catalog.attempts.map((a) => timestamp(a.terminalReceiptAt)),
      ) +
      90 * DAY;
    this.windowStart = this.terminal + DAY90_WINDOW_START * DAY;
    this.expiry = this.terminal + 180 * DAY;
    this.journal = new Journal(
      journalRoot,
      frozen.catalog.admission.maxJournalBytes,
    );
    const policy = {
      type: "RETENTION_POLICY",
      witnessSha256: trust.witnessSha256,
      storageWitnessSha256: trust.storageWitnessSha256,
      terminalReceiptAt: this.identity.terminalReceiptAt,
      minimumRetainUntil: new Date(this.expiry).toISOString(),
      day90DueAt: new Date(this.due).toISOString(),
      day90WindowOpensAt: new Date(this.windowStart).toISOString(),
    };
    if (!this.journal.rows.length) {
      check(timestamp(now) >= this.terminal, "TIME");
      this.journal.reserve();
      this.journal.append(policy, now);
    } else check(equal(this.journal.rows[0].payload, policy), "POLICY_CHANGED");
  }
  append(payload, now) {
    this.journal.reserve();
    return this.journal.append(payload, now);
  }
  state() {
    const holds = new Set();
    const immediate = new Set();
    const day90 = new Set();
    const revoked = new Set();
    let incident = false;
    for (const { payload: p } of this.journal.rows) {
      if (p.type === "HOLD_ADD") holds.add(p.holdId);
      if (p.type === "HOLD_RELEASE") holds.delete(p.holdId);
      if (p.type === "INCIDENT") incident = true;
      if (p.type === "GRANT_REVOKED") revoked.add(p.grantId);
      if (p.type === "RESTORE_RECEIPT") {
        if (p.purpose === "IMMEDIATE") immediate.add(p.domainId);
        if (
          p.purpose === "DAY90" &&
          timestamp(p.restoredAt) >= this.windowStart &&
          timestamp(p.restoredAt) <= this.due
        )
          day90.add(p.domainId);
      }
    }
    return { holds, immediate, day90, revoked, incident };
  }
  status(now = new Date().toISOString()) {
    // Persist every calendar observation; a restart cannot reset clock high water.
    this.append({ type: "CALENDAR_CHECK" }, now);
    const state = this.state();
    if (
      timestamp(now) > this.due &&
      state.day90.size !== 2 &&
      !this.journal.rows.some((r) => r.payload.code === "DAY90_MISSED")
    ) {
      this.append({ type: "INCIDENT", code: "DAY90_MISSED" }, now);
    }
    return {
      format: "mmp-evidence-retention-status-v1",
      immediateRestore:
        state.immediate.size === 2 ? "SIMULATED_VERIFIED" : "NOT_VERIFIED",
      day90:
        state.day90.size === 2
          ? "SIMULATED_VERIFIED"
          : timestamp(now) > this.due
            ? "NOT_VERIFIED"
            : "DUE_TASK_PENDING",
      hold: state.holds.size > 0 || this.state().incident,
      minimumRetainUntil: new Date(this.expiry).toISOString(),
      day90DueAt: new Date(this.due).toISOString(),
      G4: "INCONCLUSIVE",
    };
  }
  dueTasks(now = new Date().toISOString()) {
    const status = this.status(now);
    return this.domains
      .filter((d) => !this.state().day90.has(d))
      .map((domainId) => ({
        format: "mmp-evidence-day90-task-v1",
        domainId,
        witnessRef: this.identity.witnessRef,
        dueAt: status.day90DueAt,
        notBefore: new Date(this.windowStart).toISOString(),
        status: timestamp(now) > this.due ? "OVERDUE_NOT_VERIFIED" : "PENDING",
        action: "INDEPENDENT_FULL_RESTORE",
      }));
  }
  recordRestore(record, now = new Date().toISOString()) {
    const p = authenticated(record, this.readerPublicKey, digest(record));
    const expected = this.versions
      .filter((r) => r.domainId === p.domainId)
      .map((r) => r.versionId)
      .sort();
    check(
      p.purpose !== "DAY90" || timestamp(p.at) >= this.windowStart,
      "DAY90_WINDOW",
    );
    check(
      p.format === "mmp-evidence-restore-v1" &&
        p.status === "SIMULATED_RESTORED" &&
        p.witnessSha256 === this.trust.witnessSha256 &&
        p.storageWitnessSha256 === this.trust.storageWitnessSha256 &&
        p.manifestSha256 === this.manifestSha256 &&
        p.packCount === this.packCount &&
        p.fileCount === this.fileCount &&
        this.domains.includes(p.domainId) &&
        equal([...p.versions].sort(), expected) &&
        ["IMMEDIATE", "DAY90"].includes(p.purpose) &&
        timestamp(p.at) >= this.terminal &&
        timestamp(p.at) <= timestamp(now),
      "RESTORE_RECEIPT",
    );
    this.append(
      {
        type: "RESTORE_RECEIPT",
        receiptSha256: digest(record),
        domainId: p.domainId,
        purpose: p.purpose,
        restoredAt: p.at,
      },
      now,
    );
  }
  hold(holdId, now = new Date().toISOString()) {
    id(holdId);
    this.append({ type: "HOLD_ADD", holdId }, now);
  }
  ownerApproval(records, action, now, extra = {}) {
    check(
      Array.isArray(records) && records.length === 2,
      "TWO_OWNERS_REQUIRED",
    );
    for (let i = 0; i < 2; i++) {
      const p = authenticated(
        records[i],
        this.ownerPublicKeys[i],
        digest(records[i]),
      );
      check(
        equal(p, {
          format: "mmp-evidence-owner-action-v1",
          action,
          witnessRef: this.identity.witnessRef,
          at: now,
          witnessSha256: this.trust.witnessSha256,
          storageWitnessSha256: this.trust.storageWitnessSha256,
          ...extra,
        }),
        "OWNER_AUTHORIZATION",
      );
    }
  }
  releaseHold(holdId, approvals, now = new Date().toISOString()) {
    id(holdId);
    this.ownerApproval(approvals, "RELEASE_HOLD", now, { holdId });
    check(this.state().holds.has(holdId), "HOLD");
    this.append({ type: "HOLD_RELEASE", holdId }, now);
  }
  revoke(grantId, now = new Date().toISOString()) {
    id(grantId);
    this.append({ type: "GRANT_REVOKED", grantId }, now);
  }
  deletionPlan(approvals, reviewRecord, now = new Date().toISOString()) {
    try {
      this.status(now);
      check(timestamp(now) >= this.expiry, "PREMATURE_DELETION");
      const state = this.state();
      check(!state.holds.size && !state.incident, "DELETION_HELD");
      this.ownerApproval(approvals, "DELETE", now);
      const review = authenticated(
        reviewRecord,
        this.reviewerPublicKey,
        digest(reviewRecord),
      );
      check(
        equal(review, {
          format: "mmp-evidence-no-hold-v1",
          witnessRef: this.identity.witnessRef,
          at: now,
          noHold: true,
          witnessSha256: this.trust.witnessSha256,
          storageWitnessSha256: this.trust.storageWitnessSha256,
        }),
        "REVIEW_AUTHORIZATION",
      );
      const plan = {
        format: "mmp-evidence-deletion-plan-v1",
        witnessRef: this.identity.witnessRef,
        at: now,
        targets: [...this.domains, "escrow", "snapshots"],
        witnessSha256: this.trust.witnessSha256,
        storageWitnessSha256: this.trust.storageWitnessSha256,
      };
      this.append(
        { type: "DELETION_AUTHORIZED", planSha256: digest(plan) },
        now,
      );
      return { ...plan, journalCheckpoint: this.journal.checkpoint() };
    } catch (error) {
      this.append({ type: "DELETION_DENIED" }, now);
      throw error;
    }
  }
  recordDeletion(plan, signedReceipts, now = new Date().toISOString()) {
    this.journal.verify(plan.journalCheckpoint);
    check(
      this.journal.rows.some(
        (r) =>
          r.payload.type === "DELETION_AUTHORIZED" &&
          r.payload.planSha256 === digest(planBody(plan)),
      ),
      "DELETION_UNAUTHORIZED",
    );
    check(
      timestamp(now) >= timestamp(plan.at) &&
        !this.state().holds.size &&
        !this.state().incident,
      "DELETION_HELD",
    );
    check(
      signedReceipts.length === plan.targets.length && this.deletionWitnessKeys,
      "DELETION_UNVERIFIED",
    );
    for (const [i, target] of plan.targets.entries()) {
      const p = authenticated(
        signedReceipts[i],
        this.deletionWitnessKeys[target],
        digest(signedReceipts[i]),
      );
      check(
        equal(p, {
          format: "mmp-evidence-deletion-witness-v1",
          target,
          planSha256: digest(plan),
          status: "SYNTHETIC_DELETED_OR_ABSENT",
          at: now,
        }),
        "DELETION_UNVERIFIED",
      );
    }
    this.append({ type: "DELETION_VERIFIED", planSha256: digest(plan) }, now);
    return "SYNTHETIC_DELETION_VERIFIED";
  }
  close() {
    this.journal.close();
  }
}
