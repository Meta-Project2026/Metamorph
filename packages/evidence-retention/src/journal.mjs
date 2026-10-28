import { closeSync, constants, openSync } from "node:fs";
import { join } from "node:path";
import {
  bytes,
  canonical,
  check,
  digest,
  equal,
  LIMITS,
  timestamp,
} from "./core.mjs";
import { PRIVILEGED } from "./policy-events.mjs";
import { Directory } from "./secure-fs.mjs";

/** Append-only API, not WORM against its owner/root. External signed checkpoints
 * detect rollback/substitution; real independently administered journal pending. */
export class Journal {
  #validator;
  constructor(path, maxBytes = LIMITS.journal, validator = null) {
    this.#validator = validator;
    this.dir = new Directory(path);
    this.maxBytes = maxBytes;
    this.rows = [];
    this.total = 0;
    this.lastAt = null;
    this.locked = false;
    try {
      this.withLock(() => {
        const names = this.names();
        check(names.length <= LIMITS.events, "JOURNAL_BUDGET");
        for (const [seq, name] of names.entries()) {
          check(
            name === `${String(seq).padStart(6, "0")}.json`,
            "JOURNAL_TAMPERED",
          );
          const data = this.dir.read(name, 4096);
          this.total += data.length;
          check(this.total <= maxBytes, "JOURNAL_BUDGET");
          const row = canonical(data, 4096);
          check(
            row.seq === seq &&
              row.previousSha256 ===
                (seq ? digest(this.rows.at(-1)) : "0".repeat(64)),
            "JOURNAL_TAMPERED",
          );
          check(
            this.lastAt === null || timestamp(row.at) >= timestamp(this.lastAt),
            "JOURNAL_TAMPERED",
          );
          this.lastAt = row.at;
          this.validate(row.payload, row.at, this.rows);
          this.rows.push(row);
        }
      });
    } catch (error) {
      this.dir.close();
      throw error;
    }
  }
  names() {
    return this.dir.names().filter((name) => name !== "mutation.lock");
  }
  validate(payload, at, previous) {
    check(!PRIVILEGED.has(payload.type) || this.#validator, "EVENT_AUTHORITY");
    this.#validator?.(payload, at, previous);
  }
  revalidate() {
    this.assertCurrent();
    const prior = [];
    for (const row of this.rows) {
      this.validate(row.payload, row.at, prior);
      prior.push(row);
    }
  }
  /** Synchronous cooperating-writer lock. A crash leaves a stale lock and fails
   * closed; removing it requires separately witnessed operator recovery. */
  withLock(action) {
    if (this.locked) return action();
    this.dir.assert();
    const fd = openSync(
      join(this.dir.anchor, "mutation.lock"),
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    this.locked = true;
    let result;
    let failure;
    try {
      result = action();
      check(!result?.then, "ASYNC_LOCK_UNSUPPORTED");
    } catch (error) {
      failure = error;
    }
    try {
      closeSync(fd);
      this.dir.remove("mutation.lock");
    } catch (error) {
      if (failure)
        Object.defineProperty(failure, "secondaryErrors", {
          value: [...(failure.secondaryErrors ?? []), error],
          configurable: true,
        });
      else failure = error;
    } finally {
      this.locked = false;
    }
    if (failure) throw failure;
    return result;
  }
  assertCurrent() {
    check(
      equal(
        this.names(),
        this.rows.map((_, i) => `${String(i).padStart(6, "0")}.json`),
      ),
      "JOURNAL_CHANGED",
    );
    if (this.rows.length) {
      const last = this.rows.length - 1;
      check(
        this.dir
          .read(`${String(last).padStart(6, "0")}.json`, 4096)
          .equals(bytes(this.rows[last])),
        "JOURNAL_CHANGED",
      );
    }
  }
  reserve() {
    check(
      this.rows.length + 2 <= LIMITS.events &&
        this.total + 8192 <= this.maxBytes,
      "JOURNAL_BUDGET",
    );
  }
  append(payload, at = new Date().toISOString()) {
    return this.withLock(() => {
      this.assertCurrent();
      check(this.rows.length < LIMITS.events, "JOURNAL_BUDGET");
      timestamp(at);
      const rollback =
        this.lastAt !== null && timestamp(at) < timestamp(this.lastAt);
      if (rollback)
        payload = { type: "INCIDENT", code: "CLOCK_ROLLBACK", observedAt: at };
      const row = {
        seq: this.rows.length,
        at: rollback ? this.lastAt : at,
        previousSha256: this.rows.length
          ? digest(this.rows.at(-1))
          : "0".repeat(64),
        payload,
      };
      const data = bytes(row);
      this.validate(row.payload, row.at, this.rows);
      check(
        data.length <= 4096 && this.total + data.length <= this.maxBytes,
        "JOURNAL_BUDGET",
      );
      this.dir.publish(`${String(row.seq).padStart(6, "0")}.json`, data);
      this.rows.push(row);
      this.total += data.length;
      this.lastAt = row.at;
      check(!rollback, "CLOCK_ROLLBACK");
      return this.checkpoint();
    });
  }
  checkpoint() {
    this.assertCurrent();
    return {
      format: "mmp-evidence-journal-checkpoint-v1",
      count: this.rows.length,
      sha256: this.rows.length ? digest(this.rows.at(-1)) : "0".repeat(64),
    };
  }
  verify(checkpoint) {
    check(equal(this.checkpoint(), checkpoint), "JOURNAL_ROLLBACK");
  }
  close() {
    this.dir.close();
  }
}
