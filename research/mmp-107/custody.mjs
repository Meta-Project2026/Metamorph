// INERT RESEARCH ONLY. No production imports, subprocesses, network or file writes.
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readdirSync,
  readSync,
  realpathSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { types } from "node:util";

export const FORMAT = "mmp107-inert-test-x25519-aes256gcm-v1";
export const LIMIT = Object.freeze({
  files: 64,
  file: 256 * 1024,
  total: 1024 * 1024,
  envelope: 2 * 1024 * 1024,
  cipher: 3 * 1024 * 1024,
});
export const NOTICE =
  "// SPDX-License-Identifier: MIT\n// Copyright (c) 2026 Metamorph contributors\n";
export const digest = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
const insist = (ok) => {
  if (!ok) throw new Error("CUSTODY_REJECTED");
};
const hex = /^[a-f0-9]{64}$/;
const identityKeys = [
  "runId",
  "runAttempt",
  "headSha",
  "sourceSha",
  "candidateSha",
  "attemptId",
];

// Proxies are rejected before reflection; accessors never run. No object coercion.
export function data(value, depth = 0) {
  insist(depth < 10 && !types.isProxy(value));
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    insist(
      value === null ||
        typeof value !== "number" ||
        Number.isSafeInteger(value),
    );
    return value;
  }
  if (typeof value === "string") {
    insist(Buffer.byteLength(value) <= LIMIT.envelope);
    return value;
  }
  insist(value && typeof value === "object");
  const array = Array.isArray(value);
  insist(
    Object.getPrototypeOf(value) ===
      (array ? Array.prototype : Object.prototype),
  );
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  insist(keys.length <= 100 && keys.every((key) => typeof key === "string"));
  if (array)
    insist(
      descriptors.length.value <= LIMIT.files &&
        keys.length === descriptors.length.value + 1,
    );
  const result = array ? [] : {};
  for (const key of keys) {
    if (array && key === "length") continue;
    const d = descriptors[key];
    insist(
      Object.hasOwn(d, "value") &&
        d.enumerable &&
        key !== "__proto__" &&
        key !== "constructor",
    );
    if (array)
      insist(
        /^(0|[1-9][0-9]*)$/.test(key) && Number(key) < descriptors.length.value,
      );
    result[key] = data(d.value, depth + 1);
  }
  return Object.freeze(result);
}
const exact = (v, keys) =>
  insist(Object.keys(v).sort().join() === [...keys].sort().join());
export function identity(value) {
  const v = data(value);
  exact(v, identityKeys);
  insist(/^[1-9][0-9]{0,19}$/.test(v.runId) && v.runAttempt === "1");
  insist(
    [v.headSha, v.sourceSha].every(
      (s) => typeof s === "string" && /^[a-f0-9]{40}$/.test(s),
    ),
  );
  insist(typeof v.candidateSha === "string" && hex.test(v.candidateSha));
  insist(
    typeof v.attemptId === "string" &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
        v.attemptId,
      ),
  );
  return v;
}
const sameIdentity = (a, b) => identityKeys.every((k) => a[k] === b[k]);
export function candidateDigest(files) {
  return digest(
    JSON.stringify(
      [...files]
        .sort((a, b) => a.path.localeCompare(b.path, "en"))
        .map(({ path, content }) => ({
          path,
          sha256: digest(content),
          content,
        })),
    ),
  );
}
const safePath = (p) =>
  typeof p === "string" &&
  p.length <= 240 &&
  /^src\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.ts$/.test(p) &&
  !p
    .split(/[/.]/)
    .some((s) =>
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9]|reference|oracle|tests?|fixtures?|heldout|policy|ci)$/i.test(
        s,
      ),
    );
export function filesValidated(input) {
  const files = data(input);
  insist(
    Array.isArray(files) && files.length > 0 && files.length <= LIMIT.files,
  );
  let total = 0;
  const paths = new Set();
  for (const f of files) {
    exact(f, ["path", "content"]);
    insist(
      safePath(f.path) &&
        typeof f.content === "string" &&
        !f.content.includes("\0"),
    );
    insist(!paths.has(f.path.toLowerCase()));
    paths.add(f.path.toLowerCase());
    const bytes = Buffer.byteLength(f.content);
    total += bytes;
    insist(bytes <= LIMIT.file && total <= LIMIT.total);
    // Tripwire only, not a proof that arbitrary secrets are absent.
    insist(
      !/MODEL_API_KEY|AGE-SECRET-KEY-|-----BEGIN.*PRIVATE KEY|github_pat_|ghp_|\bBearer\s/i.test(
        f.content,
      ),
    );
  }
  insist(
    paths.has("src/main.ts") && files.some((f) => f.content.includes(NOTICE)),
  );
  return Object.freeze(
    [...files].sort((a, b) => a.path.localeCompare(b.path, "en")),
  );
}
const unchanged = (a, b) =>
  a.dev === b.dev &&
  a.ino === b.ino &&
  a.size === b.size &&
  a.mtimeMs === b.mtimeMs &&
  a.ctimeMs === b.ctimeMs &&
  a.nlink === b.nlink;

// Host-owned, quiescent root. This is not a sandbox against a hostile same-UID host.
export function readCandidate(root) {
  insist(typeof root === "string");
  root = resolve(root);
  const nodes = [];
  const files = [];
  let entries = 0;
  function walk(dir, prefix = "", depth = 0) {
    insist(depth <= 8);
    const before = lstatSync(dir);
    insist(
      before.isDirectory() &&
        !before.isSymbolicLink() &&
        realpathSync(dir) === dir,
    );
    nodes.push([dir, before]);
    for (const name of readdirSync(dir).sort()) {
      insist(
        ++entries <= 128 &&
          /^[a-zA-Z0-9_.-]+$/.test(name) &&
          ![".", ".."].includes(name),
      );
      const full = join(dir, name),
        path = prefix + name,
        s = lstatSync(full);
      insist(!s.isSymbolicLink() && realpathSync(full) === full);
      if (s.isDirectory()) {
        insist(
          path === "src" ||
            /^src\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+$/.test(path),
        );
        walk(full, `${path}/`, depth + 1);
        continue;
      }
      insist(
        s.isFile() &&
          s.nlink === 1 &&
          s.size <= LIMIT.file &&
          safePath(path) &&
          files.length < LIMIT.files,
      );
      const fd = openSync(
        full,
        constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
      );
      const buffer = Buffer.alloc(LIMIT.file + 1);
      try {
        const opened = fstatSync(fd);
        insist(opened.isFile() && opened.nlink === 1 && unchanged(s, opened));
        let n = 0,
          count;
        do {
          count = readSync(fd, buffer, n, buffer.length - n, n);
          n += count;
        } while (count && n < buffer.length);
        insist(
          n === s.size &&
            n <= LIMIT.file &&
            unchanged(opened, fstatSync(fd)) &&
            unchanged(s, lstatSync(full)),
        );
        files.push({
          path,
          content: new TextDecoder("utf-8", { fatal: true }).decode(
            buffer.subarray(0, n),
          ),
        });
      } finally {
        buffer.fill(0);
        closeSync(fd);
      }
    }
    insist(unchanged(before, lstatSync(dir)));
  }
  walk(root);
  for (const [path, before] of nodes)
    insist(unchanged(before, lstatSync(path)) && realpathSync(path) === path);
  return filesValidated(files);
}

export function recipientFingerprint(publicKey) {
  insist(
    publicKey?.type === "public" && publicKey.asymmetricKeyType === "x25519",
  );
  return digest(publicKey.export({ type: "spki", format: "der" }));
}
const aad = (fingerprint) => Buffer.from(`${FORMAT}:${fingerprint}`);
export function encryptTest(plaintext, publicKey) {
  const ephemeral = generateKeyPairSync("x25519"),
    salt = randomBytes(32),
    iv = randomBytes(12);
  const shared = diffieHellman({ privateKey: ephemeral.privateKey, publicKey });
  const key = Buffer.from(
    hkdfSync("sha256", shared, salt, aad(recipientFingerprint(publicKey)), 32),
  );
  try {
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(aad(recipientFingerprint(publicKey)));
    const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return Buffer.concat([
      ephemeral.publicKey.export({ type: "spki", format: "der" }),
      salt,
      iv,
      cipher.getAuthTag(),
      body,
    ]);
  } finally {
    key.fill(0);
    shared.fill(0);
  }
}
export function decryptTest(ciphertext, privateKey, publicKey) {
  insist(
    Buffer.isBuffer(ciphertext) &&
      ciphertext.length > 104 &&
      ciphertext.length <= LIMIT.cipher,
  );
  const ephemeral = createPublicKey({
    key: ciphertext.subarray(0, 44),
    type: "spki",
    format: "der",
  });
  const shared = diffieHellman({ privateKey, publicKey: ephemeral });
  const key = Buffer.from(
    hkdfSync(
      "sha256",
      shared,
      ciphertext.subarray(44, 76),
      aad(recipientFingerprint(publicKey)),
      32,
    ),
  );
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      ciphertext.subarray(76, 88),
    );
    decipher.setAAD(aad(recipientFingerprint(publicKey)));
    decipher.setAuthTag(ciphertext.subarray(88, 104));
    const plain = Buffer.concat([
      decipher.update(ciphertext.subarray(104)),
      decipher.final(),
    ]);
    try {
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(plain),
      );
    } finally {
      plain.fill(0);
    }
  } finally {
    key.fill(0);
    shared.fill(0);
  }
}

// Every issuer/adapter here is a TEST HOST capability, never authority from a worker.
export function createResearchHost({
  expected,
  publicKey,
  pinnedFingerprint,
  encrypt = encryptTest,
  deadlineMs = 1000,
}) {
  expected = identity(expected);
  insist(
    recipientFingerprint(publicKey) === pinnedFingerprint &&
      Number.isSafeInteger(deadlineMs) &&
      deadlineMs > 0 &&
      deadlineMs <= 30000,
  );
  const admitted = new WeakMap(),
    finalizers = new WeakSet(),
    acknowledgments = new WeakSet();
  let state = "CREATED",
    sealed = false,
    ciphertext = null,
    captureHash = null,
    cipherBytes = 0;
  const receipt = () =>
    Object.freeze({
      format: FORMAT,
      state,
      verification: "UNVERIFIED",
      identity: expected,
      recipientFingerprint: pinnedFingerprint,
      ciphertextSha256: captureHash,
      ciphertextBytes: cipherBytes,
      productionAuthority: "NONE",
    });
  const terminate = (next) => {
    sealed = true;
    state = next;
    ciphertext?.fill(0);
    ciphertext = null;
    return receipt();
  };
  return Object.freeze({
    admit(root, claimed, license) {
      insist(
        !sealed &&
          state === "CREATED" &&
          sameIdentity(identity(claimed), expected) &&
          license === "MIT_ORIGINAL_SYNTHETIC_ONLY",
      );
      const files = readCandidate(root);
      insist(candidateDigest(files) === expected.candidateSha);
      const token = Object.freeze({});
      admitted.set(token, files);
      state = "ADMITTED";
      return token;
    },
    async capture(token, signal) {
      insist(
        !sealed &&
          state === "ADMITTED" &&
          admitted.has(token) &&
          signal instanceof AbortSignal,
      );
      state = "CAPTURING";
      const files = admitted.get(token);
      admitted.delete(token);
      const plaintext = Buffer.from(
        JSON.stringify({
          format: FORMAT,
          identity: expected,
          license: "MIT_ORIGINAL_SYNTHETIC_ONLY",
          files: files.map((f) => ({
            ...f,
            bytes: Buffer.byteLength(f.content),
            sha256: digest(f.content),
          })),
        }),
      );
      let timer, abort;
      try {
        insist(plaintext.length <= LIMIT.envelope && !signal.aborted);
        const stop = new Promise((_, reject) => {
          abort = () => reject(new Error("CUSTODY_REJECTED"));
          signal.addEventListener("abort", abort, { once: true });
          timer = setTimeout(abort, deadlineMs);
        });
        const output = await Promise.race([
          Promise.resolve().then(() => encrypt(plaintext, publicKey)),
          stop,
        ]);
        insist(
          !sealed &&
            !signal.aborted &&
            Buffer.isBuffer(output) &&
            output.length > 104 &&
            output.length <= LIMIT.cipher,
        );
        ciphertext = Buffer.from(output);
        captureHash = digest(ciphertext);
        cipherBytes = ciphertext.length;
        state = "CAPTURED_UNVERIFIED";
        return receipt();
      } catch {
        return sealed ? receipt() : terminate("CAPTURE_FAILED");
      } finally {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        plaintext.fill(0);
      }
    },
    // A caller with this issuer is the trusted synthetic host; raw worker JSON cannot substitute.
    finalizer(value) {
      insist(!sealed && state === "CAPTURED_UNVERIFIED");
      const v = data(value);
      exact(v, [
        "identity",
        "normalCleanup",
        "containers",
        "volumes",
        "emergencyRemoved",
        "collectorClean",
      ]);
      insist(
        sameIdentity(identity(v.identity), expected) &&
          v.normalCleanup === true &&
          v.collectorClean === true &&
          v.containers === 0 &&
          v.volumes === 0 &&
          v.emergencyRemoved === 0,
      );
      const token = Object.freeze({});
      finalizers.add(token);
      return token;
    },
    exportForMock(finalizer) {
      insist(
        !sealed &&
          state === "CAPTURED_UNVERIFIED" &&
          finalizers.has(finalizer) &&
          digest(ciphertext) === captureHash,
      );
      finalizers.delete(finalizer);
      state = "EXPORT_READY_UNVERIFIED";
      return Buffer.from(ciphertext);
    },
    mockAcknowledgment(value) {
      insist(!sealed && state === "EXPORT_READY_UNVERIFIED");
      const v = data(value);
      exact(v, ["identity", "sha256", "bytes"]);
      insist(
        sameIdentity(identity(v.identity), expected) &&
          v.sha256 === captureHash &&
          v.bytes === cipherBytes,
      );
      const token = Object.freeze({});
      acknowledgments.add(token);
      return token;
    },
    finishUpload(ack) {
      insist(!sealed && state === "EXPORT_READY_UNVERIFIED");
      if (!acknowledgments.has(ack)) return terminate("UPLOAD_FAILED");
      acknowledgments.delete(ack);
      return terminate("STORED_UNVERIFIED");
    },
    cancel() {
      return sealed ? receipt() : terminate("CANCELLED");
    },
    seal() {
      return sealed ? receipt() : terminate("SEALED_UNVERIFIED");
    },
    receipt,
  });
}
