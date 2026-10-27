// Trusted isolated destructive control ONLY, never a candidate-facing action.
import {
  closeSync,
  openSync,
  statfsSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { DatabaseSync } from "node:sqlite";

const mode = process.argv[2];
if (!["aux", "wal"].includes(mode)) throw new Error("MODE");
const mount = statfsSync("/state");
if (
  mount.type !== 0x01021994 ||
  mount.bsize * mount.blocks !== 16 * 1024 * 1024
)
  throw new Error("QUOTA_NOT_ENFORCED");
let code,
  written = 0,
  db;
try {
  if (mode === "aux") {
    const fd = openSync("/state/quota-aux", "wx", 0o600);
    try {
      const block = Buffer.alloc(65536, 0x61);
      while (written <= 17 * 1024 * 1024) written += writeSync(fd, block);
    } finally {
      closeSync(fd);
    }
  } else {
    db = new DatabaseSync("/state/quota-wal.sqlite");
    db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; PRAGMA synchronous=FULL; CREATE TABLE fill(value BLOB)",
    );
    const insert = db.prepare("INSERT INTO fill VALUES (zeroblob(65536))");
    while (written <= 17 * 1024 * 1024) {
      insert.run();
      written += 65536;
    }
  }
} catch (e) {
  code = mode === "aux" ? e.code : e.errcode === 13 ? "SQLITE_FULL" : "OTHER";
} finally {
  db?.close();
}
if (
  code !== (mode === "aux" ? "ENOSPC" : "SQLITE_FULL") ||
  written <= 0 ||
  written > 16 * 1024 * 1024
)
  throw new Error("QUOTA_CONTROL_FAILED");
for (const name of mode === "aux"
  ? ["quota-aux"]
  : ["quota-wal.sqlite", "quota-wal.sqlite-wal", "quota-wal.sqlite-shm"]) {
  try {
    unlinkSync(`/state/${name}`);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
console.log(
  JSON.stringify({
    mode,
    code,
    totalBytes: mount.bsize * mount.blocks,
    writtenBytes: written,
    type: "tmpfs",
  }),
);
