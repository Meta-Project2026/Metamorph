import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import {
  dirname,
  isAbsolute,
  join,
  parse,
  relative,
  resolve,
  sep,
} from "node:path";
import { ensure, sha256 } from "./manifest.js";

export const RETENTION = Object.freeze({
  local: "OWNER_ONLY_LOCAL_PRIVATE_PACK",
  durable: "EVIDENCE_RETENTION_NOT_CONFIGURED",
  external: "EXTERNAL_RETENTION_NOT_RUN",
});
function noLinks(path: string): void {
  let current = parse(path).root;
  for (const component of path
    .slice(current.length)
    .split(/[\\/]/)
    .filter(Boolean)) {
    current = join(current, component);
    ensure(!lstatSync(current).isSymbolicLink(), "EVIDENCE_SYMLINK");
  }
}
function ownerDirectory(path: string): void {
  noLinks(path);
  const st = lstatSync(path);
  ensure(
    st.isDirectory() &&
      st.uid === process.getuid?.() &&
      (st.mode & 0o077) === 0,
    "EVIDENCE_PERMISSIONS",
  );
}
/** Linux/POSIX local retention only. Windows ACLs and external storage are unsupported, fail closed. */
export class PrivateEvidence {
  readonly path: string;
  private bytes = 0;
  private entries: { id: string; bytes: number; sha256: string }[] = [];
  private sealed = false;
  constructor(parent: string, publicRoot: string, provenance: unknown) {
    ensure(
      process.platform !== "win32" && isAbsolute(parent),
      "EVIDENCE_PLATFORM",
    );
    const root = resolve(publicRoot);
    const target = resolve(parent);
    const rel = relative(root, target);
    ensure(
      rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel),
      "EVIDENCE_PUBLIC_ROOT",
    );
    ownerDirectory(target);
    this.path = mkdtempSync(join(target, "oracle-"));
    ownerDirectory(this.path);
    this.write("provenance", provenance);
  }
  write(id: string, value: unknown): void {
    ensure(
      !this.sealed &&
        /^[a-z0-9][a-z0-9-]{0,119}$/.test(id) &&
        !this.entries.some((e) => e.id === id),
      "EVIDENCE_ID",
    );
    const data = Buffer.from(JSON.stringify(value));
    ensure(
      data.length <= 16 * 1024 * 1024 &&
        this.bytes + data.length <= 128 * 1024 * 1024,
      "EVIDENCE_LIMIT",
    );
    ownerDirectory(this.path);
    const temp = join(this.path, `.${id}.tmp`);
    const fd = openSync(
      temp,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      writeFileSync(fd, data);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    const final = join(this.path, `${id}.json`);
    // The directory is 0700 and only this broker writes it; IDs are exclusive.
    renameSync(temp, final);
    const dir = openSync(this.path, constants.O_RDONLY | constants.O_DIRECTORY);
    try {
      fsyncSync(dir);
    } finally {
      closeSync(dir);
    }
    this.entries.push({ id, bytes: data.length, sha256: sha256(data) });
    this.bytes += data.length;
  }
  seal(): string {
    ensure(!this.sealed, "EVIDENCE_SEALED");
    const index = {
      format: "oracle-private-pack-v1",
      retention: RETENTION,
      entries: [...this.entries],
    };
    this.write("index", index);
    this.sealed = true;
    return sha256(JSON.stringify(index));
  }
  static verify(path: string, expectedIndexSha256: string): number {
    ownerDirectory(path);
    const read = (id: string): Buffer => {
      ensure(/^[a-z0-9][a-z0-9-]{0,119}$/.test(id), "EVIDENCE_ID");
      const fd = openSync(
        join(path, `${id}.json`),
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      try {
        const st = fstatSync(fd);
        ensure(
          st.isFile() &&
            st.nlink === 1 &&
            st.uid === process.getuid?.() &&
            (st.mode & 0o077) === 0 &&
            st.size <= 16 * 1024 * 1024,
          "EVIDENCE_PERMISSIONS",
        );
        return readFileSync(fd);
      } finally {
        closeSync(fd);
      }
    };
    const bytes = read("index");
    ensure(sha256(bytes) === expectedIndexSha256, "EVIDENCE_TAMPERED");
    const index = JSON.parse(bytes.toString());
    ensure(
      index.format === "oracle-private-pack-v1" && Array.isArray(index.entries),
      "EVIDENCE_INDEX",
    );
    const names = new Set<string>();
    let total = 0;
    for (const entry of index.entries) {
      ensure(!names.has(entry.id), "EVIDENCE_ID");
      names.add(entry.id);
      const data = read(entry.id);
      total += data.length;
      ensure(
        total <= 128 * 1024 * 1024 &&
          data.length === entry.bytes &&
          sha256(data) === entry.sha256,
        "EVIDENCE_TAMPERED",
      );
    }
    return names.size;
  }
}
/** Convenience for a new private parent under a trusted OS temp directory. */
export function privateParent(path: string): void {
  ensure(isAbsolute(path));
  noLinks(dirname(path));
  mkdirSync(path, { mode: 0o700 });
  ownerDirectory(path);
}
