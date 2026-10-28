import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readSync,
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
    const initialNames = readdirSync(path).sort();
    const read = (id: string): Buffer => {
      ensure(/^[a-z0-9][a-z0-9-]{0,119}$/.test(id), "EVIDENCE_ID");
      const fd = openSync(
        join(path, `${id}.json`),
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      try {
        const st = fstatSync(fd, { bigint: true });
        ensure(
          st.isFile() &&
            st.nlink === 1n &&
            st.uid === BigInt(process.getuid?.() ?? -1) &&
            (st.mode & 0o077n) === 0n &&
            st.size > 0n &&
            st.size <= BigInt(16 * 1024 * 1024),
          "EVIDENCE_PERMISSIONS",
        );
        const data = Buffer.alloc(Number(st.size) + 1);
        let length = 0;
        while (length < data.length) {
          const n = readSync(fd, data, length, data.length - length, length);
          if (!n) break;
          length += n;
        }
        const after = fstatSync(fd, { bigint: true });
        const named = lstatSync(join(path, `${id}.json`), { bigint: true });
        ensure(
          length === Number(st.size) &&
            st.dev === named.dev &&
            st.ino === named.ino &&
            st.mode === named.mode &&
            st.uid === named.uid &&
            st.nlink === named.nlink &&
            st.size === named.size &&
            st.mtimeNs === after.mtimeNs &&
            st.ctimeNs === after.ctimeNs &&
            st.mtimeNs === named.mtimeNs &&
            st.ctimeNs === named.ctimeNs,
          "EVIDENCE_TAMPERED",
        );
        return data.subarray(0, length);
      } finally {
        closeSync(fd);
      }
    };
    const bytes = read("index");
    ensure(sha256(bytes) === expectedIndexSha256, "EVIDENCE_TAMPERED");
    const index = JSON.parse(bytes.toString());
    ensure(
      index.format === "oracle-private-pack-v1" &&
        Array.isArray(index.entries) &&
        Buffer.from(JSON.stringify(index)).equals(bytes),
      "EVIDENCE_INDEX",
    );
    const names = new Set<string>();
    let total = bytes.length;
    for (const entry of index.entries) {
      ensure(
        entry &&
          typeof entry.id === "string" &&
          entry.id !== "index" &&
          !names.has(entry.id) &&
          Number.isSafeInteger(entry.bytes) &&
          entry.bytes > 0 &&
          typeof entry.sha256 === "string" &&
          /^[a-f0-9]{64}$/.test(entry.sha256),
        "EVIDENCE_ID",
      );
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
    const expectedNames = [...names]
      .map((id) => `${id}.json`)
      .concat("index.json")
      .sort();
    ownerDirectory(path);
    ensure(
      JSON.stringify(initialNames) === JSON.stringify(expectedNames) &&
        JSON.stringify(readdirSync(path).sort()) ===
          JSON.stringify(expectedNames),
      "EVIDENCE_INDEX",
    );
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
