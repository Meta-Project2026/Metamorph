import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";

export const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");
export function validateBundle(files, expectedSha) {
  if (!Array.isArray(files) || files.length < 1 || files.length > 64)
    throw new Error("ADMISSION_REJECTED: file count");
  let total = 0;
  const seen = new Set();
  const canonical = files
    .map((file) => {
      if (
        !file ||
        Object.keys(file).sort().join() !== "content,path,sha256" ||
        !/^src\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.ts$/.test(file.path) ||
        file.path.length > 240 ||
        /(?:^|\/)(?:con|prn|aux|nul|com[1-9]|lpt[1-9]|reference|oracle|tests?|fixtures?|held[-_]?out|policy|ci)(?:\/|\.ts$)/i.test(
          file.path,
        ) ||
        typeof file.content !== "string" ||
        file.content.includes("\0") ||
        Buffer.byteLength(file.content) > 256 * 1024 ||
        sha256(file.content) !== file.sha256 ||
        seen.has(file.path.toLowerCase())
      )
        throw new Error("ADMISSION_REJECTED: source/path/hash");
      seen.add(file.path.toLowerCase());
      total += Buffer.byteLength(file.content);
      return { path: file.path, sha256: file.sha256, content: file.content };
    })
    .sort((a, b) => a.path.localeCompare(b.path, "en"));
  if (total > 1024 * 1024 || !seen.has("src/main.ts"))
    throw new Error("ADMISSION_REJECTED: size/entrypoint");
  const candidateSha = sha256(JSON.stringify(canonical));
  if (expectedSha !== undefined && candidateSha !== expectedSha)
    throw new Error("ADMISSION_REJECTED: candidate hash");
  return { files: canonical, candidateSha };
}

// Snapshot bytes once; later host filesystem mutation cannot change admitted bytes.
// Caller exclusively owns the staging directory. No concurrent untrusted host writer.
export async function admitDirectory(inputRoot, expectedSha) {
  const root = resolve(inputRoot);
  if ((await lstat(root)).isSymbolicLink() || (await realpath(root)) !== root)
    throw new Error("ADMISSION_REJECTED: root link/junction");
  const files = [];
  async function walk(directory, prefix = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix + entry.name;
      const absolute = join(directory, entry.name);
      const info = await lstat(absolute);
      if (info.isSymbolicLink() || (await realpath(absolute)) !== absolute)
        throw new Error("ADMISSION_REJECTED: link/junction");
      if (info.isDirectory()) {
        if (!/^(?:src)(?:\/[a-zA-Z0-9_-]+)*$/.test(path) || path.length > 230)
          throw new Error("ADMISSION_REJECTED: directory");
        await walk(absolute, `${path}/`);
      } else {
        if (
          !info.isFile() ||
          info.nlink !== 1 ||
          info.size > 256 * 1024 ||
          files.length >= 64
        )
          throw new Error("ADMISSION_REJECTED: file/link/size");
        const handle = await open(
          absolute,
          constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
        );
        try {
          const opened = await handle.stat();
          if (
            !opened.isFile() ||
            opened.nlink !== 1 ||
            opened.ino !== info.ino ||
            opened.dev !== info.dev
          )
            throw new Error("ADMISSION_REJECTED: changed file");
          // Fixed-size read prevents a growing file from exhausting host memory.
          const bytes = Buffer.alloc(256 * 1024 + 1);
          const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
          if (bytesRead > 256 * 1024)
            throw new Error("ADMISSION_REJECTED: growing file");
          const content = new TextDecoder("utf-8", { fatal: true }).decode(
            bytes.subarray(0, bytesRead),
          );
          files.push({ path, sha256: sha256(content), content });
        } finally {
          await handle.close();
        }
      }
    }
  }
  await walk(root);
  return validateBundle(files, expectedSha);
}
