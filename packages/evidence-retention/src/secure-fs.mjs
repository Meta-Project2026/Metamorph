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
  readSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { check, id, integer } from "./core.mjs";

export function component(value) {
  check(
    typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9-]{0,119}$/.test(value),
    "PATH",
  );
}

const stable = (a, b) =>
  ["dev", "ino", "mode", "uid", "nlink", "size", "mtimeNs", "ctimeNs"].every(
    (k) => a[k] === b[k],
  );
export function platform() {
  check(
    process.platform === "linux" && typeof process.getuid === "function",
    "UNSUPPORTED_PLATFORM",
  );
}
function owner(st, directory) {
  check(
    (directory ? st.isDirectory() : st.isFile()) &&
      st.uid === BigInt(process.getuid()) &&
      (st.mode & 0o777n) === (directory ? 0o700n : 0o600n),
    "PERMISSIONS",
  );
  if (!directory) check(st.nlink === 1n, "HARDLINK");
}
/** Linux descriptor-relative operations via procfs. No path re-resolution of
 * mutable ancestor directories between check and use. Trusted uid/root remains
 * in the trust base; an administrator cannot be confined by this adapter. */
export class Directory {
  constructor(path, parent = null, name = null) {
    platform();
    this.parent = parent;
    this.name = name;
    if (!parent) {
      check(
        isAbsolute(path) &&
          path === resolve(path) &&
          path === realpathSync(path),
        "ROOT",
      );
      this.path = path;
    } else {
      parent.assert();
      component(name);
      this.path = join(parent.anchor, name);
    }
    const before = lstatSync(this.path, { bigint: true });
    owner(before, true);
    this.fd = openSync(
      this.path,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    this.anchor = `/proc/self/fd/${this.fd}`;
    try {
      check(stable(before, fstatSync(this.fd, { bigint: true })), "CHANGED");
      this.identity = before;
      this.assert();
    } catch (error) {
      closeSync(this.fd);
      throw error;
    }
  }
  assert() {
    if (this.parent) this.parent.assert();
    const current = fstatSync(this.fd, { bigint: true });
    owner(current, true);
    const named = lstatSync(this.path, { bigint: true });
    check(
      current.dev === this.identity.dev &&
        current.ino === this.identity.ino &&
        stable(current, named),
      "CHANGED",
    );
  }
  names() {
    this.assert();
    return readdirSync(this.anchor).sort();
  }
  child(name, create = false) {
    component(name);
    this.assert();
    if (create) {
      mkdirSync(join(this.anchor, name), { mode: 0o700 });
      this.sync();
    }
    return new Directory(null, this, name);
  }
  read(name, limit, { allowEmpty = false } = {}) {
    check(
      /^[a-z0-9][a-z0-9.-]{0,130}$/.test(name) && !name.includes(".."),
      "PATH",
    );
    integer(limit, 1, 1024 * 1024 * 1024);
    this.assert();
    const path = join(this.anchor, name);
    const before = lstatSync(path, { bigint: true });
    owner(before, false);
    check(
      before.size >= (allowEmpty ? 0n : 1n) && before.size <= BigInt(limit),
      "BUDGET",
    );
    const fd = openSync(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      check(stable(before, fstatSync(fd, { bigint: true })), "CHANGED");
      const buffer = Buffer.alloc(Number(before.size) + 1);
      let length = 0;
      while (length < buffer.length) {
        const n = readSync(fd, buffer, length, buffer.length - length, length);
        if (!n) break;
        length += n;
      }
      check(
        length === Number(before.size) &&
          stable(before, fstatSync(fd, { bigint: true })) &&
          stable(before, lstatSync(path, { bigint: true })),
        "CHANGED",
      );
      this.assert();
      return buffer.subarray(0, length);
    } finally {
      closeSync(fd);
    }
  }
  publish(name, data, failAt = null) {
    check(
      /^[a-z0-9][a-z0-9.-]{0,130}$/.test(name) && !name.includes(".."),
      "PATH",
    );
    this.assert();
    const stage = join(this.anchor, `${name}.stage`);
    const final = join(this.anchor, name);
    const fd = openSync(
      stage,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      if (failAt === "WRITE") {
        writeFileSync(
          fd,
          data.subarray(0, Math.max(1, Math.floor(data.length / 2))),
        );
        fsyncSync(fd);
        check(false, "INTERRUPTED");
      }
      writeFileSync(fd, data);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    check(failAt !== "FSYNC", "INTERRUPTED");
    this.assert();
    // Atomic NOREPLACE publication: link fails EEXIST; rename would overwrite.
    linkSync(stage, final);
    unlinkSync(stage);
    this.sync();
    check(failAt !== "PUBLISH", "INTERRUPTED");
  }
  remove(name) {
    this.assert();
    check(
      /^[a-z0-9][a-z0-9.-]{0,130}$/.test(name) && !name.includes(".."),
      "PATH",
    );
    unlinkSync(join(this.anchor, name));
    this.sync();
  }
  finish(stageName, finalName) {
    id(stageName);
    id(finalName);
    this.assert();
    check(!this.names().includes(finalName), "OVERWRITE");
    // Parent is 0700, reserved uniquely for this operation by its trusted owner.
    // Final publication is a directory rename; untrusted same-uid/root is excluded.
    renameSync(join(this.anchor, stageName), join(this.anchor, finalName));
    this.sync();
  }
  sync() {
    fsyncSync(this.fd);
  }
  close() {
    closeSync(this.fd);
  }
}
