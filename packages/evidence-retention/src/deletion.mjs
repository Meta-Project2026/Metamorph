import {
  check,
  DAY,
  DAY90_WINDOW_START,
  digest,
  equal,
  timestamp,
} from "./core.mjs";

export function planBody(plan) {
  const { journalCheckpoint: _checkpoint, ...body } = plan;
  return body;
}
/** Invoke while holding the mutation lock through unlink. ANY later journal
 * transition invalidates a previously authorized checkpoint-bound permit. */
export function verifyDeletionState(journal, authority, permit, now) {
  check(
    permit?.journalCheckpoint && authority.ledgerRoot,
    "DELETION_PLAN_REQUIRED",
  );
  journal.verify(permit.journalCheckpoint);
  journal.revalidate();
  const first = journal.rows[0]?.payload;
  check(
    first?.type === "RETENTION_POLICY" &&
      first.witnessSha256 === authority.witnessSha256 &&
      first.storageWitnessSha256 === authority.storageWitnessSha256 &&
      first.terminalReceiptAt === authority.terminalReceiptAt,
    "DELETION_POLICY",
  );
  const body = planBody(permit);
  check(
    body.format === "mmp-evidence-deletion-plan-v1" &&
      body.witnessRef === authority.witnessRef &&
      body.witnessSha256 === authority.witnessSha256 &&
      body.storageWitnessSha256 === authority.storageWitnessSha256 &&
      body.at === now,
    "DELETION_POLICY",
  );
  const last = journal.rows.at(-1)?.payload;
  check(
    last?.type === "DELETION_AUTHORIZED" && last.planSha256 === digest(body),
    "DELETION_UNAUTHORIZED",
  );
  const domains = [
    ...new Set(authority.versions.map((v) => v.domainId)),
  ].sort();
  check(
    equal(body.targets, [...domains, "escrow", "snapshots"]),
    "DELETION_POLICY",
  );
  const holds = new Set();
  const day90 = new Set();
  const terminal = timestamp(authority.terminalReceiptAt);
  const due = timestamp(first.day90DueAt);
  check(
    due >= terminal + DAY90_WINDOW_START * DAY && due <= terminal + 90 * DAY,
    "DELETION_POLICY",
  );
  let incident = false;
  for (const { payload: p } of journal.rows) {
    if (p.type === "HOLD_ADD") holds.add(p.holdId);
    if (p.type === "HOLD_RELEASE") holds.delete(p.holdId);
    if (p.type === "INCIDENT") incident = true;
    if (
      p.type === "RESTORE_RECEIPT" &&
      p.purpose === "DAY90" &&
      domains.includes(p.domainId) &&
      timestamp(p.restoredAt) >= terminal + DAY90_WINDOW_START * DAY &&
      timestamp(p.restoredAt) <= due
    )
      day90.add(p.domainId);
  }
  check(!holds.size && !incident && day90.size === 2, "DELETION_HELD");
}
