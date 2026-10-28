import { anchor } from "./authority.mjs";
import {
  check,
  DAY,
  DAY90_WINDOW_START,
  digest,
  equal,
  id,
  timestamp,
} from "./core.mjs";
import {
  authenticated,
  keyId,
  signed,
  verifyCatalogWitness,
} from "./crypto.mjs";
import { planBody } from "./deletion.mjs";
import { Journal } from "./journal.mjs";
import {
  eventValidator,
  PRIVILEGED,
  policyContext,
  reduced,
  validateRestore,
} from "./policy-events.mjs";

/** UTC calendar deadlines. The caller of the synthetic simulation can pass a
 * deterministic test time. Real deployment requires a trusted external clock
 * and independently witnessed journal high-water marks; local root can lie. */
export class RetentionLedger {
  #signer;
  constructor({
    journalRoot,
    witness,
    storageWitness,
    trust,
    readerPublicKey,
    ownerPublicKeys,
    reviewerPublicKey,
    deletionWitnessKeys = null,
    anchorRoot,
    authorityPrivateKey = null,
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
    this.context = policyContext({
      witness,
      storageWitness,
      trust,
      readerPublicKey,
      ownerPublicKeys,
      reviewerPublicKey,
      deletionWitnessKeys,
    });
    this.anchorRoot = anchorRoot;
    this.#signer = authorityPrivateKey;
    if (this.#signer)
      check(
        keyId(this.#signer) === keyId(trust.witnessPublicKey),
        "EVENT_AUTHORITY",
      );
    this.journal = new Journal(
      journalRoot,
      frozen.catalog.admission.maxJournalBytes,
      eventValidator(this.context),
    );
    try {
      const policy = {
        type: "RETENTION_POLICY",
        contextSha256: digest(this.context),
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
        this.#commit(policy, now);
      } else {
        const { authorization: _a, ...stored } = this.journal.rows[0].payload;
        check(equal(stored, policy), "POLICY_CHANGED");
        this.journal.withLock(() =>
          anchor(this.anchorRoot, this.context, this.journal),
        );
      }
    } catch (error) {
      this.journal.close();
      throw error;
    }
  }
  append(payload, now) {
    return this.#write(payload, now, false);
  }
  #commit(payload, now) {
    return this.#write(payload, now, true);
  }
  #write(payload, now = new Date().toISOString(), privileged = false) {
    check(this.#signer, "EVENT_AUTHORITY");
    this.journal.reserve();
    return this.journal.withLock(() => {
      this.journal.assertCurrent();
      if (this.journal.rows.length)
        anchor(this.anchorRoot, this.context, this.journal);
      const count = this.journal.rows.length;
      if (privileged && PRIVILEGED.has(payload.type)) {
        check(this.#signer, "EVENT_AUTHORITY");
        payload = {
          ...payload,
          authorization: signed(
            {
              format: "mmp-policy-event-v1",
              contextSha256: digest(this.context),
              previous: this.journal.checkpoint(),
              at: now,
              payloadSha256: digest(payload),
            },
            this.#signer,
          ),
        };
      }
      let failure, result;
      try {
        result = this.journal.append(payload, now);
      } catch (e) {
        failure = e;
      }
      if (this.journal.rows.length === count + 1) {
        try {
          anchor(this.anchorRoot, this.context, this.journal, this.#signer);
        } catch (e) {
          if (!failure) failure = e;
          else
            Object.defineProperty(failure, "secondaryErrors", {
              value: [...(failure.secondaryErrors ?? []), e],
              configurable: true,
            });
        }
      }
      if (failure) throw failure;
      return result;
    });
  }
  state() {
    this.journal.revalidate();
    return reduced(this.context, this.journal.rows);
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
    validateRestore(this.context, record, now);
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
    this.#commit(
      {
        type: "RESTORE_RECEIPT",
        record,
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
    this.#commit({ type: "HOLD_RELEASE", holdId, approvals }, now);
  }
  revoke(grantId, now = new Date().toISOString()) {
    id(grantId);
    this.#commit({ type: "GRANT_REVOKED", grantId }, now);
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
      this.#commit(
        {
          type: "DELETION_AUTHORIZED",
          planSha256: digest(plan),
          plan,
          approvals,
          reviewRecord,
        },
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
    this.#commit(
      {
        type: "DELETION_VERIFIED",
        planSha256: digest(plan),
        plan,
        receipts: signedReceipts,
      },
      now,
    );
    return "SYNTHETIC_DELETION_VERIFIED";
  }
  close() {
    this.journal.close();
  }
}
