import {
  closeSync,
  constants,
  fstatSync,
  ftruncateSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { type CandidateWriter, SourceChangesSchema } from "./ports.js";

// The parent is trusted host configuration. The model cannot choose this root.
export function createCandidateWriter(parent: string): CandidateWriter {
  const root = realpathSync(
    mkdtempSync(join(realpathSync(parent), "metamorph-candidate-")),
  );
  mkdirSync(join(root, "src"));
  function assertDirectory(path: string) {
    const info = lstatSync(path);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      realpathSync(path) !== path
    ) {
      throw new Error("UNSAFE_CANDIDATE_DIRECTORY");
    }
  }
  return {
    root,
    async write(proposals, signal) {
      signal.throwIfAborted();
      const changes = SourceChangesSchema.parse(proposals);
      // Validate every target before writing any file. No delete/rename/execute.
      const targets = changes.map((change) => {
        const target = join(root, ...change.path.split("/"));
        const rel = relative(root, target);
        if (rel.startsWith(`..${sep}`) || rel === ".." || rel === "") {
          throw new Error("CANDIDATE_ESCAPE");
        }
        assertDirectory(root);
        let current = root;
        for (const part of change.path.split("/").slice(0, -1)) {
          current = join(current, part);
          try {
            mkdirSync(current);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
          }
          assertDirectory(current);
        }
        try {
          const info = lstatSync(target);
          if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) {
            throw new Error("UNSAFE_CANDIDATE_FILE");
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        return { ...change, target };
      });
      for (const change of targets) {
        signal.throwIfAborted();
        assertDirectory(dirname(change.target));
        // No truncation until file type/link count is checked on the open handle.
        const fd = openSync(
          change.target,
          constants.O_WRONLY | constants.O_CREAT | (constants.O_NOFOLLOW ?? 0),
          0o600,
        );
        try {
          const info = fstatSync(fd);
          if (!info.isFile() || info.nlink !== 1)
            throw new Error("UNSAFE_CANDIDATE_FILE");
          // writeFileSync on an fd does not truncate an existing longer file.
          signal.throwIfAborted();
          ftruncateSync(fd, 0);
          writeFileSync(fd, change.content, "utf8");
        } finally {
          closeSync(fd);
        }
      }
    },
  };
}
