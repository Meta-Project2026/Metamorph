// Separate pre-Oracle proof. No exported self-attestation issuer or worker authority.
import { join } from "node:path";
import {
  CUSTODY,
  exact,
  plainData,
  receiptFor,
  requireCustody,
  sameIdentity,
  validateReceipt,
} from "./custody-contract.mjs";
import {
  cipherAt,
  commitRecord,
  exactReadback,
  privateDirectory,
  readRecord,
} from "./custody-files.mjs";
import { diagnosticCommand } from "./encrypt-diagnostics.mjs";

const owned = (name) =>
  /^(mmp007-|mmp-reference-|mmp-reference-state-|mmp-inspector-|mmp008a-clock-)[a-z0-9-]+$/.test(
    name,
  );
export async function finalizeCustody(identity) {
  const list = async (volume) => {
    const result = await diagnosticCommand(
      volume
        ? ["volume", "ls", "--format", "{{.Name}}"]
        : ["container", "ls", "--all", "--format", "{{.Names}}"],
      { timeoutMs: 10000, limit: 65536 },
    );
    requireCustody(result.ok);
    return result.bytes.toString().trim().split(/\s+/).filter(owned);
  };
  const containers = await list(false),
    volumes = await list(true);
  for (const name of containers)
    requireCustody(
      (
        await diagnosticCommand(["rm", "--force", name], {
          timeoutMs: 10000,
          limit: 4096,
        })
      ).ok,
    );
  for (const name of volumes)
    requireCustody(
      (
        await diagnosticCommand(["volume", "rm", name], {
          timeoutMs: 10000,
          limit: 4096,
        })
      ).ok,
    );
  return plainData({
    format: "mmp115-pre-oracle-finalizer-v1",
    phase: "PRE_ORACLE",
    identity,
    containers: (await list(false)).length,
    volumes: (await list(true)).length,
    emergencyRemoved: containers.length + volumes.length,
  });
}
export function checkpointReady(capture, finalizer, expected) {
  const c = validateReceipt(capture, expected, "CAPTURED_UNVERIFIED"),
    f = plainData(finalizer);
  exact(f, [
    "format",
    "phase",
    "identity",
    "containers",
    "volumes",
    "emergencyRemoved",
  ]);
  requireCustody(
    f.format === "mmp115-pre-oracle-finalizer-v1" &&
      f.phase === "PRE_ORACLE" &&
      sameIdentity(f.identity, c.identity) &&
      f.containers === 0 &&
      f.volumes === 0 &&
      f.emergencyRemoved === 0,
  );
  return receiptFor(
    "CHECKPOINT_READY_UNVERIFIED",
    c.identity,
    { sha256: c.ciphertextSha256, bytes: c.ciphertextBytes },
    c.collectorCleanup,
  );
}
export function artifactMetadata(record, artifact, run, acknowledgment) {
  const c = validateReceipt(
      record,
      record.identity,
      "CHECKPOINT_READY_UNVERIFIED",
    ),
    a = plainData(artifact),
    r = plainData(run),
    ack = plainData(acknowledgment);
  exact(ack, [
    "artifactId",
    "archiveSha256",
    "uploadOutcome",
    "downloadOutcome",
  ]);
  requireCustody(
    /^[1-9][0-9]{0,19}$/.test(ack.artifactId) &&
      /^[a-f0-9]{64}$/.test(ack.archiveSha256) &&
      ack.uploadOutcome === "success" &&
      ack.downloadOutcome === "success",
  );
  requireCustody(
    Number.isSafeInteger(a.id) &&
      String(a.id) === ack.artifactId &&
      a.name === `mmp107-candidate-${c.identity.runId}-1` &&
      a.expired === false &&
      a.digest === `sha256:${ack.archiveSha256}` &&
      Number.isSafeInteger(a.size_in_bytes) &&
      a.size_in_bytes > 100 &&
      a.size_in_bytes <= CUSTODY.ciphertext + 65536,
  );
  requireCustody(
    String(a.workflow_run?.id) === c.identity.runId &&
      a.workflow_run.head_sha === c.identity.headSha &&
      a.workflow_run.repository_id === a.workflow_run.head_repository_id,
  );
  requireCustody(
    Number.isSafeInteger(a.workflow_run.repository_id) &&
      a.workflow_run.repository_id > 0 &&
      a.workflow_run.repository_id === r.repository?.id &&
      a.workflow_run.head_repository_id === r.head_repository?.id,
  );
  requireCustody(
    String(r.id) === c.identity.runId &&
      r.head_sha === c.identity.headSha &&
      r.run_attempt === 1 &&
      r.event === "workflow_dispatch" &&
      r.path === ".github/workflows/meta-paid-migration.yml" &&
      r.head_repository?.full_name === "Meta-Project2026/Metamorph" &&
      r.repository?.full_name === "Meta-Project2026/Metamorph",
  );
  return c;
}
// Production caller passes only fixed-origin authenticated API responses + actual readback.
export function verifiedReadback(ready, artifact, run, ack, directory) {
  const c = artifactMetadata(ready, artifact, run, ack);
  exactReadback(directory, c);
  return receiptFor(
    "STORED_UNVERIFIED",
    c.identity,
    { sha256: c.ciphertextSha256, bytes: c.ciphertextBytes },
    c.collectorCleanup,
  );
}
const permits = new WeakMap();
export function requireStoredCheckpoint(env, expected) {
  requireCustody(
    process.platform === "linux" &&
      !env.MODEL_API_KEY &&
      env.GITHUB_RUN_ATTEMPT === "1",
  );
  const spool = join(env.RUNNER_TEMP, "mmp115-custody");
  privateDirectory(spool);
  const capture = readRecord(join(spool, "capture.json")),
    finalizer = readRecord(join(spool, "finalizer.json"));
  const ready = checkpointReady(capture, finalizer, {
    runId: env.GITHUB_RUN_ID,
    runAttempt: "1",
    headSha: env.GITHUB_SHA,
  });
  validateReceipt(capture, expected, "CAPTURED_UNVERIFIED");
  const stored = validateReceipt(
    readRecord(join(spool, "stored.json")),
    ready.identity,
    "STORED_UNVERIFIED",
  );
  requireCustody(
    stored.ciphertextSha256 === ready.ciphertextSha256 &&
      stored.ciphertextBytes === ready.ciphertextBytes,
  );
  cipherAt(join(spool, "candidate.age"), stored);
  const proof = readRecord(join(spool, "transport.json"));
  const recomputed = verifiedReadback(
    ready,
    proof.artifact,
    proof.run,
    proof.ack,
    join(env.RUNNER_TEMP, "mmp115-readback"),
  );
  requireCustody(JSON.stringify(recomputed) === JSON.stringify(stored));
  const token = Object.freeze({});
  permits.set(token, stored);
  return token;
}
export function consumeOraclePermit(
  token,
  { candidateSha, headSha, sourceSha },
) {
  const record = permits.get(token);
  requireCustody(
    record &&
      record.identity.candidateSha === candidateSha &&
      record.identity.headSha === headSha &&
      record.identity.sourceSha === sourceSha,
  );
  permits.delete(token);
  return record.identity;
}
export async function authenticatedArtifactMetadata(env) {
  requireCustody(
    typeof env.GH_TOKEN === "string" &&
      env.GH_TOKEN.length > 0 &&
      /^[1-9][0-9]{0,19}$/.test(env.MMP115_ARTIFACT_ID) &&
      /^[1-9][0-9]{0,19}$/.test(env.GITHUB_RUN_ID),
  );
  const json = async (suffix) => {
    const response = await fetch(
      `https://api.github.com/repos/Meta-Project2026/Metamorph/actions/${suffix}`,
      {
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          authorization: `Bearer ${env.GH_TOKEN}`,
          accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
    requireCustody(response.ok);
    let size = 0;
    const chunks = [];
    for await (const chunk of response.body) {
      size += chunk.length;
      requireCustody(size <= 65536);
      chunks.push(chunk);
    }
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
    );
  };
  const artifact = await json(`artifacts/${env.MMP115_ARTIFACT_ID}`),
    run = await json(`runs/${env.GITHUB_RUN_ID}`);
  return { artifact, run };
}
export function saveTransport(spool, ready, artifact, run, ack, directory) {
  const stored = verifiedReadback(ready, artifact, run, ack, directory);
  // Store only bounded binding fields, never API payloads with URLs/actor metadata.
  const a = {
    id: artifact.id,
    name: artifact.name,
    expired: artifact.expired,
    digest: artifact.digest,
    size_in_bytes: artifact.size_in_bytes,
    workflow_run: {
      id: artifact.workflow_run.id,
      head_sha: artifact.workflow_run.head_sha,
      repository_id: artifact.workflow_run.repository_id,
      head_repository_id: artifact.workflow_run.head_repository_id,
    },
  };
  const r = {
    id: run.id,
    head_sha: run.head_sha,
    run_attempt: run.run_attempt,
    event: run.event,
    path: run.path,
    head_repository: {
      id: run.head_repository.id,
      full_name: run.head_repository.full_name,
    },
    repository: { id: run.repository.id, full_name: run.repository.full_name },
  };
  commitRecord(join(spool, "transport.json"), { artifact: a, run: r, ack });
  commitRecord(join(spool, "stored.json"), stored);
  return stored;
}
