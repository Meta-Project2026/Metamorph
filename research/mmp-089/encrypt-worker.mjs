// Mounted read-only in a dedicated network-off container. No host roots, home,
// Docker socket, identities, provider responses or environment are mounted.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const [recipient, recipientSha, binarySha, version] = process.argv.slice(2);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
let plaintext;
try {
  if (!/^age1[a-z0-9]{58}$/.test(recipient) || sha(recipient) !== recipientSha || !/^[a-f0-9]{64}$/.test(binarySha) || version !== "v1.3.2" || sha(readFileSync("/tool/age")) !== binarySha) throw Error();
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 4 * 1024 * 1024) throw Error();
    chunks.push(chunk);
  }
  plaintext = Buffer.concat(chunks);
  if (!plaintext.length) throw Error();
  const cleanEnv = { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/nonexistent", TZ: "UTC" };
  const execute = (args, input, limit) => new Promise((resolve, reject) => {
    const child = spawn("/tool/age", args, { env: cleanEnv, cwd: "/", shell: false, stdio: ["pipe", "pipe", "pipe"] });
    const output = []; let bytes = 0; let failed = false;
    const timer = setTimeout(() => { failed = true; child.kill("SIGKILL"); }, 25000);
    for (const channel of ["stdout", "stderr"]) child[channel].on("data", (data) => {
      bytes += data.length;
      if (bytes > limit || channel === "stderr") { failed = true; child.kill("SIGKILL"); }
      else output.push(data);
    });
    child.on("error", () => { failed = true; });
    child.stdin.on("error", () => {});
    child.on("close", (code, signal) => { clearTimeout(timer); if (failed || code !== 0 || signal) reject(Error()); else resolve(Buffer.concat(output)); });
    child.stdin.end(input);
  });
  const actualVersion = await execute(["--version"], undefined, 100);
  if (actualVersion.toString().trim() !== version) throw Error();
  const ciphertext = await execute(["--encrypt", "--recipient", recipient], plaintext, 5 * 1024 * 1024);
  if (!ciphertext.subarray(0, 22).equals(Buffer.from("age-encryption.org/v1\n"))) throw Error();
  process.stdout.write(ciphertext);
} catch { process.exitCode = 1; }
finally { plaintext?.fill(0); }
