import {
  bytes,
  canonical,
  check,
  digest,
  equal,
  LIMITS,
  timestamp,
} from "./core.mjs";
import { Directory } from "./secure-fs.mjs";

/** Append-only API, not WORM against its owner/root. External signed checkpoints
 * detect rollback/substitution; real independently administered journal pending. */
export class Journal {
  constructor(path, maxBytes = LIMITS.journal) {
    this.dir = new Directory(path);
    this.maxBytes = maxBytes;
    this.rows = [];
    this.total = 0;
    this.lastAt = null;
    try {
      const names = this.dir.names();
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
        this.rows.push(row);
      }
    } catch (error) {
      this.dir.close();
      throw error;
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
  }
  checkpoint() {
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
