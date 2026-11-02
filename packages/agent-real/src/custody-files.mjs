// Linux host-owned spool, atomic no-clobber commits. No plaintext archive writes.

import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  realpathSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { dirname, join, parse, resolve } from "node:path";
import { sha256 } from "../../target-worker/src/admission.mjs";
import { CUSTODY, requireCustody } from "./custody-contract.mjs";
import { readPrivateBytes, readPrivateJson } from "./private-diagnostics.mjs";

export function privateDirectory(path, create = false, ownerOnly = true) {
  requireCustody(
    process.platform === "linux" &&
      typeof path === "string" &&
      path === resolve(path),
  );
  if (create) mkdirSync(path, { mode: 0o700 });
  let current = parse(path).root;
  for (const part of path.slice(current.length).split("/").filter(Boolean)) {
    current = join(current, part);
    requireCustody(
      !lstatSync(current).isSymbolicLink() && realpathSync(current) === current,
    );
  }
  const s = lstatSync(path);
  requireCustody(
    s.isDirectory() &&
      s.uid === process.getuid() &&
      (s.mode & (ownerOnly ? 0o077 : 0o022)) === 0,
  );
  return s;
}
export function commitPrivate(path, bytes, maxBytes) {
  requireCustody(
    Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= maxBytes,
  );
  const dir = dirname(path),
    before = privateDirectory(dir),
    pending = join(dir, `.pending-${randomUUID()}`);
  let fd,
    linked = false,
    created = false;
  try {
    fd = openSync(
      pending,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    created = true;
    let offset = 0;
    while (offset < bytes.length) {
      const n = writeSync(fd, bytes, offset, bytes.length - offset);
      requireCustody(n > 0);
      offset += n;
    }
    fsyncSync(fd);
    const st = fstatSync(fd);
    requireCustody(
      st.isFile() &&
        st.nlink === 1 &&
        st.uid === process.getuid() &&
        (st.mode & 0o077) === 0 &&
        st.size === bytes.length,
    );
    closeSync(fd);
    fd = undefined;
    requireCustody(
      sha256(readPrivateBytes(pending, maxBytes)) === sha256(bytes),
    );
    const after = privateDirectory(dir);
    requireCustody(before.dev === after.dev && before.ino === after.ino);
    // link(2) is atomic and refuses an existing destination; rename would clobber.
    linkSync(pending, path);
    linked = true;
    unlinkSync(pending);
    const directoryFd = openSync(
      dir,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    try {
      fsyncSync(directoryFd);
    } finally {
      closeSync(directoryFd);
    }
    const final = readPrivateBytes(path, maxBytes);
    requireCustody(
      final.length === bytes.length && sha256(final) === sha256(bytes),
    );
  } catch {
    // A crash/flush error may leave quarantined ciphertext. No receipt is issued.
    // Do not remove an existing final destination, including after link succeeded.
    try {
      if (fd !== undefined) closeSync(fd);
    } catch {
      /* no fallback */
    }
    try {
      if (created) unlinkSync(pending);
    } catch {
      /* quarantine until runner destruction */
    }
    throw new Error(
      linked ? "CUSTODY_COMMIT_INCOMPLETE" : "CUSTODY_COMMIT_REJECTED",
    );
  }
}
export function commitRecord(path, record) {
  commitPrivate(path, Buffer.from(`${JSON.stringify(record)}\n`), 16384);
}
export function readRecord(path) {
  privateDirectory(dirname(path));
  return readPrivateJson(path, 16384).value;
}
export function cipherAt(path, record, ownerOnly = true) {
  const bytes = readPrivateBytes(path, CUSTODY.ciphertext, ownerOnly);
  requireCustody(
    bytes.length === record.ciphertextBytes &&
      sha256(bytes) === record.ciphertextSha256 &&
      bytes.subarray(0, 22).equals(Buffer.from("age-encryption.org/v1\n")),
  );
  return bytes;
}
export function exactReadback(directory, record) {
  requireCustody(
    process.platform === "linux" &&
      realpathSync(directory) === resolve(directory) &&
      !lstatSync(directory).isSymbolicLink(),
  );
  requireCustody(
    JSON.stringify(readdirSync(directory).sort()) === '["candidate.age"]',
  );
  return cipherAt(join(directory, "candidate.age"), record, false);
}
