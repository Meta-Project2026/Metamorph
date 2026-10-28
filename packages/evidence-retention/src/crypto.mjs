import {
  constants,
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
  sign,
  verify,
} from "node:crypto";
import { inspect } from "./catalog.mjs";
import {
  admission,
  bytes,
  canonical,
  check,
  digest,
  equal,
  hex,
  id,
  LIMITS,
  sha,
  timestamp,
} from "./core.mjs";

const MAGIC = Buffer.from("MMP0551\n");
export const SUITE = "AES-256-GCM/RSA-OAEP-SHA256/Ed25519";
export function keyId(key) {
  return sha(createPublicKey(key).export({ type: "spki", format: "der" }));
}
function rsaPublic(key) {
  check(
    typeof key === "string" && key.startsWith("-----BEGIN PUBLIC KEY-----\n"),
    "KEY_POLICY",
  );
  const k = createPublicKey(key);
  check(
    k.asymmetricKeyType === "rsa" &&
      k.asymmetricKeyDetails.modulusLength >= 3072 &&
      k.asymmetricKeyDetails.modulusLength <= 8192,
    "KEY_POLICY",
  );
  check(k.export({ type: "spki", format: "pem" }) === key, "KEY_POLICY");
  return k;
}
export function signed(payload, privateKey) {
  const k = createPrivateKey(privateKey);
  check(k.asymmetricKeyType === "ed25519", "SIGNING_KEY");
  return {
    payload,
    signature: sign(null, bytes(payload), k).toString("base64"),
  };
}
export function authenticated(record, publicKey, expectedSha256) {
  hex(expectedSha256);
  check(
    digest(record) === expectedSha256 &&
      record &&
      typeof record.signature === "string",
    "WITNESS_MISMATCH",
  );
  const k = createPublicKey(publicKey);
  check(k.asymmetricKeyType === "ed25519", "SIGNING_KEY");
  const signature = Buffer.from(record.signature, "base64");
  check(
    signature.toString("base64") === record.signature &&
      verify(null, bytes(record.payload), k, signature),
    "WITNESS_SIGNATURE",
  );
  return record.payload;
}
function commitment(catalog, nonce) {
  const domain = Buffer.from("MMP-055-WITNESSED-CATALOG-V1\0");
  const value = bytes(catalog);
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(value.length));
  return sha(Buffer.concat([domain, nonce, length, value]));
}
/** Run by the external synthetic witness, with its own independently opened
 * source and signing key. The writer must never have this signing key. */
export function witnessCatalog(
  input,
  recipients,
  signingPrivateKey,
  observedAt,
) {
  const frozen = inspect(input);
  check(
    timestamp(observedAt) >= timestamp(frozen.catalog.teardown.finalizedAt),
    "TIME",
  );
  check(
    Array.isArray(recipients) &&
      recipients.length >= 2 &&
      recipients.length <= 4,
    "RECIPIENTS",
  );
  const recipientIds = new Set();
  const fingerprints = new Set();
  for (const r of recipients) {
    id(r.principal);
    check(["READER", "RECOVERY"].includes(r.role), "RECIPIENTS");
    const k = rsaPublic(r.publicKey);
    check(
      !recipientIds.has(r.principal) &&
        !fingerprints.has(keyId(k.export({ type: "spki", format: "pem" }))),
      "RECIPIENTS",
    );
    recipientIds.add(r.principal);
    fingerprints.add(keyId(r.publicKey));
  }
  check(
    recipients.some((r) => r.role === "READER") &&
      recipients.some((r) => r.role === "RECOVERY"),
    "RECIPIENTS",
  );
  const nonce = randomBytes(32);
  return signed(
    {
      format: "mmp-evidence-witness-v1",
      catalog: frozen.catalog,
      manifestSha256: frozen.manifestSha256,
      observedAt,
      recipients: recipients.map((r) => ({
        principal: r.principal,
        role: r.role,
        keyId: keyId(r.publicKey),
        publicKey: r.publicKey,
      })),
      blinding: nonce.toString("base64"),
      commitment: commitment(frozen.catalog, nonce),
    },
    signingPrivateKey,
  );
}
export function verifyCatalogWitness(record, publicKey, expectedSha256) {
  const p = authenticated(record, publicKey, expectedSha256);
  check(
    p.format === "mmp-evidence-witness-v1" &&
      digest(p.catalog) === p.manifestSha256,
    "WITNESS_MISMATCH",
  );
  const nonce = Buffer.from(p.blinding, "base64");
  check(
    nonce.length === 32 &&
      nonce.toString("base64") === p.blinding &&
      commitment(p.catalog, nonce) === p.commitment,
    "WITNESS_MISMATCH",
  );
  admission(p.catalog.admission);
  return p;
}
export function encrypt(
  plain,
  { identity, pack, manifestSha256, recipients },
  nonceDirectory,
) {
  check(plain.length <= LIMITS.pack + 2 * LIMITS.metadata + 260, "BUDGET");
  // Every object gets an independent OS-random DEK AND a 96-bit nonce. A durable
  // reservation rejects any repeated nonce even across independent DEKs.
  const dek = randomBytes(32);
  const nonce = randomBytes(12);
  try {
    nonceDirectory.publish(
      `${nonce.toString("hex")}.json`,
      bytes({ allocated: true }),
    );
    const header = {
      format: "mmp-encrypted-pack-v1",
      suite: SUITE,
      identity,
      packId: pack.id,
      manifestSha256,
      plainBytes: plain.length,
      nonce: nonce.toString("base64"),
      recipients: recipients.map((r) => ({
        principal: r.principal,
        role: r.role,
        keyId: r.keyId,
        wrapped: publicEncrypt(
          {
            key: rsaPublic(r.publicKey),
            padding: constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
            oaepLabel: bytes({
              manifestSha256,
              packId: pack.id,
              principal: r.principal,
            }),
          },
          dek,
        ).toString("base64"),
      })),
    };
    const meta = bytes(header);
    check(meta.length <= LIMITS.header, "BUDGET");
    const prefix = Buffer.alloc(MAGIC.length + 4);
    MAGIC.copy(prefix);
    prefix.writeUInt32BE(meta.length, MAGIC.length);
    const cipher = createCipheriv("aes-256-gcm", dek, nonce, {
      authTagLength: 16,
    });
    cipher.setAAD(Buffer.concat([prefix, meta]));
    return Buffer.concat([
      prefix,
      meta,
      cipher.update(plain),
      cipher.final(),
      cipher.getAuthTag(),
    ]);
  } finally {
    dek.fill(0);
  }
}
export function decrypt(
  blob,
  { catalog, manifestSha256, recipients },
  pack,
  principal,
  privateKey,
) {
  check(
    blob.length >= MAGIC.length + 4 + 16 &&
      blob.subarray(0, MAGIC.length).equals(MAGIC),
    "CIPHERTEXT_FORMAT",
  );
  const metaSize = blob.readUInt32BE(MAGIC.length);
  const offset = MAGIC.length + 4 + metaSize;
  check(
    metaSize <= LIMITS.header && offset + 16 <= blob.length,
    "CIPHERTEXT_FORMAT",
  );
  const header = canonical(
    blob.subarray(MAGIC.length + 4, offset),
    LIMITS.header,
  );
  check(
    header.format === "mmp-encrypted-pack-v1" &&
      header.suite === SUITE &&
      equal(header.identity, catalog.identity) &&
      header.packId === pack.id &&
      header.manifestSha256 === manifestSha256,
    "CIPHERTEXT_BINDING",
  );
  check(
    equal(
      header.recipients.map(({ principal, role, keyId }) => ({
        principal,
        role,
        keyId,
      })),
      recipients.map(({ principal, role, keyId }) => ({
        principal,
        role,
        keyId,
      })),
    ),
    "RECIPIENTS",
  );
  const recipient = header.recipients.find((r) => r.principal === principal);
  check(recipient && keyId(privateKey) === recipient.keyId, "KEY_POLICY");
  const nonce = Buffer.from(header.nonce, "base64");
  check(
    nonce.length === 12 && nonce.toString("base64") === header.nonce,
    "NONCE",
  );
  const wrapped = Buffer.from(recipient.wrapped, "base64");
  check(wrapped.toString("base64") === recipient.wrapped, "KEY_POLICY");
  let dek;
  try {
    dek = privateDecrypt(
      {
        key: privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
        oaepLabel: bytes({ manifestSha256, packId: pack.id, principal }),
      },
      wrapped,
    );
    check(
      dek.length === 32 && header.plainBytes === blob.length - offset - 16,
      "CIPHERTEXT_FORMAT",
    );
    const decipher = createDecipheriv("aes-256-gcm", dek, nonce, {
      authTagLength: 16,
    });
    decipher.setAAD(blob.subarray(0, offset));
    decipher.setAuthTag(blob.subarray(-16));
    // No plaintext file is written before final() validates the authentication tag.
    return Buffer.concat([
      decipher.update(blob.subarray(offset, -16)),
      decipher.final(),
    ]);
  } finally {
    dek?.fill(0);
  }
}
