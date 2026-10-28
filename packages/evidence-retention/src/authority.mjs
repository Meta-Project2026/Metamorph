import {
  bytes,
  canonical,
  check,
  digest,
  equal,
  LIMITS,
  RetentionError,
} from "./core.mjs";
import { authenticated, signed } from "./crypto.mjs";
import { Journal } from "./journal.mjs";
import { eventValidator, reduced } from "./policy-events.mjs";
import { Directory } from "./secure-fs.mjs";

export function directoryIdentity(path) {
  const d = new Directory(path);
  try {
    return { dev: String(d.identity.dev), ino: String(d.identity.ino) };
  } finally {
    d.close();
  }
}
/** Independently administered append-only live high-water source. The immutable
 * reader config pins its directory inode and authority key/context, not a cached
 * snapshot. Rolling back both this source and the journal by uid/root is outside
 * the synthetic trust boundary and is NOT claimed to be prevented. */
export function anchor(
  root,
  context,
  journal,
  privateKey = null,
  pinned = null,
) {
  const d = new Directory(root);
  try {
    if (pinned)
      check(
        equal(pinned, {
          dev: String(d.identity.dev),
          ino: String(d.identity.ino),
        }),
        "AUTHORITY_SUBSTITUTED",
      );
    const names = d.names();
    check(names.length <= LIMITS.events, "AUTHORITY_BUDGET");
    let prior = "0".repeat(64),
      latest = null,
      total = 0;
    for (const [i, name] of names.entries()) {
      check(
        name === `${String(i).padStart(6, "0")}.json`,
        "AUTHORITY_HIGH_WATER",
      );
      const raw = d.read(name, 4096);
      total += raw.length;
      check(total <= LIMITS.journal, "AUTHORITY_BUDGET");
      const record = canonical(raw, 4096);
      const p = authenticated(
        record,
        context.authorityPublicKey,
        digest(record),
      );
      check(
        p.format === "mmp-policy-anchor-v1" &&
          p.contextSha256 === digest(context) &&
          p.previous === prior &&
          p.checkpoint.count === i + 1,
        "AUTHORITY_HIGH_WATER",
      );
      // Every anchored prefix must equal the independently replay-validated log.
      check(
        journal.rows.length >= p.checkpoint.count &&
          digest(journal.rows[p.checkpoint.count - 1]) === p.checkpoint.sha256,
        "AUTHORITY_ROLLBACK",
      );
      prior = digest(record);
      latest = p.checkpoint;
    }
    const current = journal.checkpoint();
    if (privateKey) {
      check(current.count === names.length + 1, "AUTHORITY_HIGH_WATER");
      const record = signed(
        {
          format: "mmp-policy-anchor-v1",
          contextSha256: digest(context),
          previous: prior,
          checkpoint: current,
        },
        privateKey,
      );
      check(total + bytes(record).length <= LIMITS.journal, "AUTHORITY_BUDGET");
      d.publish(`${String(names.length).padStart(6, "0")}.json`, bytes(record));
    } else check(latest && equal(current, latest), "AUTHORITY_HIGH_WATER");
  } finally {
    d.close();
  }
}
export function withRecoveryAuthority(config, expected, action) {
  let journal;
  try {
    check(
      config?.format === "mmp-live-policy-authority-v1" &&
        config.anchorIdentity &&
        equal(config.context, expected),
      "RECOVERY_AUTHORITY_UNAVAILABLE",
    );
    journal = new Journal(
      config.journalRoot,
      LIMITS.journal,
      eventValidator(expected),
    );
    return journal.withLock(() => {
      journal.assertCurrent();
      journal.revalidate();
      anchor(config.anchorRoot, expected, journal, null, config.anchorIdentity);
      return action(reduced(expected, journal.rows));
    });
  } catch (error) {
    if (
      error instanceof RetentionError &&
      error.code === "RECOVERY_NOT_AUTHORIZED"
    )
      throw error;
    const failure = new RetentionError("RECOVERY_AUTHORITY_UNAVAILABLE");
    failure.cause = error;
    if (error.secondaryErrors) failure.secondaryErrors = error.secondaryErrors;
    throw failure;
  } finally {
    journal?.close();
  }
}
