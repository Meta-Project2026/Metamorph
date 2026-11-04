import { randomBytes, randomInt, verify } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute } from "node:path";
import { apply, EMPTY_HASH, initialState, signers } from "./state.mjs";
import {
  canonical,
  commitment,
  hash,
  id,
  object,
  RegistryError,
  requireThat,
  validateTrust,
} from "./validation.mjs";

const MAX_JOURNAL_BYTES = 2 * 1024 * 1024;
const MAX_LINE_BYTES = 128 * 1024;
const MAX_EVENTS = 64;
const ENTROPY = {
  bytes: (n) => randomBytes(n),
  int: (maximum) => randomInt(maximum),
};

function adapterCall(fn) {
  try {
    return fn();
  } catch {
    throw new RegistryError("REGISTRY_IO_OR_ADAPTER_ERROR");
  }
}

function signatureValid(publicKey, message, encoded) {
  if (typeof encoded !== "string" || !/^[A-Za-z0-9+/]{86}==$/.test(encoded))
    return false;
  try {
    return verify(
      null,
      Buffer.from(message, "hex"),
      publicKey,
      Buffer.from(encoded, "base64"),
    );
  } catch {
    return false;
  }
}

function checkpointMessage(seq, eventHash) {
  return hash(
    canonical({
      domain: "mmp-056-witness-checkpoint-v1",
      seq,
      hash: eventHash,
    }),
  );
}

function verifyCheckpoint(cp, trust) {
  object(cp, ["seq", "hash", "signature"]);
  requireThat(
    Number.isSafeInteger(cp.seq) && cp.seq >= 0 && cp.seq <= MAX_EVENTS,
    "WITNESS_CHECKPOINT_INVALID",
  );
  requireThat(
    typeof cp.hash === "string" && /^[a-f0-9]{64}$/.test(cp.hash),
    "WITNESS_CHECKPOINT_INVALID",
  );
  requireThat(
    signatureValid(
      trust.principals[trust.witness],
      checkpointMessage(cp.seq, cp.hash),
      cp.signature,
    ),
    "WITNESS_SIGNATURE_INVALID",
  );
}

function validateEvent(event, previous, seq, trust, trustHash) {
  object(event, ["seq", "prev", "at", "type", "payload", "trustHash"]);
  requireThat(
    event.seq === seq && event.prev === previous,
    "JOURNAL_CHAIN_INVALID",
  );
  requireThat(event.trustHash === trustHash, "TRUST_DRIFT");
  requireThat(
    typeof event.at === "string" &&
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(event.at) &&
      new Date(event.at).toISOString() === event.at,
    "TIME_INVALID",
  );
  signers(event.type, trust);
}

export function verifySignatures(event, signatures, trust) {
  const required = signers(event.type, trust);
  object(signatures, required, "AUTHORITY_SET_INVALID");
  const message = hash(canonical({ domain: "mmp-056-transition-v1", event }));
  for (const principal of required) {
    requireThat(
      signatureValid(
        trust.principals[principal],
        message,
        signatures[principal],
      ),
      "AUTHORITY_SIGNATURE_INVALID",
    );
  }
}

function parseJournal(path, trust, trustHash, checkpoint) {
  verifyCheckpoint(checkpoint, trust);
  const size = statSync(path).size;
  requireThat(size <= MAX_JOURNAL_BYTES, "JOURNAL_OVERSIZE");
  const raw = readFileSync(path, "utf8");
  requireThat(
    Buffer.byteLength(raw) === size && (raw.length === 0 || raw.endsWith("\n")),
    "JOURNAL_TRUNCATED",
  );
  const lines = raw.length ? raw.slice(0, -1).split("\n") : [];
  requireThat(lines.length <= MAX_EVENTS, "JOURNAL_OVERSIZE");
  let previous = EMPTY_HASH;
  let state = initialState();
  let previousTime = "";
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    requireThat(Buffer.byteLength(line) <= MAX_LINE_BYTES, "JOURNAL_OVERSIZE");
    let record;
    try {
      record = JSON.parse(line);
      requireThat(canonical(record) === line, "JOURNAL_ENCODING_INVALID");
    } catch {
      throw new RegistryError("JOURNAL_ENCODING_INVALID");
    }
    object(record, ["event", "signatures", "hash", "witness"]);
    validateEvent(record.event, previous, index + 1, trust, trustHash);
    requireThat(record.event.at >= previousTime, "CLOCK_ROLLBACK");
    verifySignatures(record.event, record.signatures, trust);
    requireThat(
      hash(
        canonical({ event: record.event, signatures: record.signatures }),
      ) === record.hash,
      "JOURNAL_HASH_INVALID",
    );
    verifyCheckpoint(record.witness, trust);
    requireThat(
      record.witness.seq === index + 1 && record.witness.hash === record.hash,
      "WITNESS_MISMATCH",
    );
    state = apply(state, record.event, trust, record.hash);
    previous = record.hash;
    previousTime = record.event.at;
  }
  requireThat(
    checkpoint.seq === lines.length && checkpoint.hash === previous,
    "WITNESS_HIGH_WATER_MISMATCH",
  );
  return { state, seq: lines.length, head: previous, previousTime };
}

class SyntheticRegistry {
  #path;
  #trust;
  #trustHash;
  #witness;
  #authorize;
  #entropy;

  constructor(config, entropy) {
    object(config, ["journalPath", "trust", "witness", "authorize"]);
    requireThat(
      typeof config.journalPath === "string" && isAbsolute(config.journalPath),
      "ABSOLUTE_JOURNAL_REQUIRED",
    );
    validateTrust(config.trust);
    requireThat(
      config.witness &&
        typeof config.witness.checkpoint === "function" &&
        typeof config.witness.record === "function",
      "WITNESS_REQUIRED",
    );
    requireThat(typeof config.authorize === "function", "AUTHORITY_REQUIRED");
    this.#path = config.journalPath;
    this.#trust = JSON.parse(canonical(config.trust));
    this.#trustHash = hash(canonical(this.#trust));
    this.#witness = config.witness;
    this.#authorize = config.authorize;
    this.#entropy = entropy;
    try {
      if (!existsSync(this.#path)) {
        const fd = openSync(this.#path, "wx", 0o600);
        try {
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }
      }
    } catch {
      throw new RegistryError("REGISTRY_IO_OR_ADAPTER_ERROR");
    }
    this.#locked(() => this.#load());
  }

  #locked(fn) {
    const lock = `${this.#path}.lock`;
    let fd;
    try {
      fd = openSync(lock, "wx", 0o600);
    } catch {
      throw new RegistryError("JOURNAL_LOCKED");
    }
    let result;
    let failure;
    try {
      result = fn();
    } catch (error) {
      failure =
        error instanceof RegistryError
          ? error
          : new RegistryError("REGISTRY_IO_OR_ADAPTER_ERROR");
    }
    try {
      closeSync(fd);
      unlinkSync(lock);
    } catch {
      failure ??= new RegistryError("REGISTRY_IO_OR_ADAPTER_ERROR");
    }
    if (failure) throw failure;
    return result;
  }

  #load() {
    return parseJournal(
      this.#path,
      this.#trust,
      this.#trustHash,
      adapterCall(() => this.#witness.checkpoint()),
    );
  }

  #append(type, payload, current) {
    requireThat(current.seq < MAX_EVENTS, "JOURNAL_OVERSIZE");
    const event = {
      seq: current.seq + 1,
      prev: current.head,
      at: new Date().toISOString(),
      type,
      payload: JSON.parse(canonical(payload)),
      trustHash: this.#trustHash,
    };
    requireThat(event.at >= current.previousTime, "CLOCK_ROLLBACK");
    const next = apply(current.state, event, this.#trust);
    const required = signers(type, this.#trust);
    const intentHash = hash(
      canonical({ domain: "mmp-056-transition-v1", event }),
    );
    const signatures = adapterCall(() =>
      this.#authorize(intentHash, [...required], type),
    );
    verifySignatures(event, signatures, this.#trust);
    const eventHash = hash(canonical({ event, signatures }));
    // No local write occurs without a prior independently signed high-water
    // acknowledgement. A crash between these operations locks out replay.
    const witness = adapterCall(() =>
      this.#witness.record({
        seq: event.seq,
        prev: event.prev,
        hash: eventHash,
        event,
        signatures,
      }),
    );
    verifyCheckpoint(witness, this.#trust);
    requireThat(
      witness.seq === event.seq && witness.hash === eventHash,
      "WITNESS_MISMATCH",
    );
    const line = `${canonical({ event, signatures, hash: eventHash, witness })}\n`;
    requireThat(
      Buffer.byteLength(line) <= MAX_LINE_BYTES &&
        statSync(this.#path).size + Buffer.byteLength(line) <=
          MAX_JOURNAL_BYTES,
      "JOURNAL_OVERSIZE",
    );
    const fd = openSync(this.#path, "a");
    try {
      writeFileSync(fd, line, "utf8");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    return {
      state: next,
      seq: event.seq,
      head: eventHash,
      previousTime: event.at,
    };
  }

  #opening() {
    const bytes = adapterCall(() => this.#entropy.bytes(32));
    requireThat(Buffer.isBuffer(bytes) && bytes.length === 32, "ENTROPY_ERROR");
    return bytes.toString("hex");
  }

  register(registration) {
    return this.#locked(() => {
      const current = this.#load();
      const opening = this.#opening();
      const registrationCommitment = commitment(
        "MMP-056-REGISTRATION-V1",
        opening,
        registration,
      );
      this.#append(
        "REGISTER",
        { registration, opening, registrationCommitment },
        current,
      );
      return this.#receiptUnlocked();
    });
  }

  freeze(freeze) {
    return this.#locked(() => {
      const current = this.#load();
      requireThat(current.state.stage === "REGISTERED", "FREEZE_ORDER");
      const opening = this.#opening();
      const candidateCommitment = commitment(
        "MMP-056-CANDIDATE-V1",
        opening,
        freeze,
      );
      this.#append(
        "FREEZE",
        {
          freeze,
          opening,
          candidateCommitment,
          registrationCommitment: current.state.registrationCommitment,
        },
        current,
      );
      return this.#receiptUnlocked();
    });
  }

  draw(request) {
    object(request, ["drawId"]);
    id(request.drawId);
    return this.#locked(() => {
      let current = this.#load();
      current = this.#append(
        "DRAW_STARTED",
        {
          drawId: request.drawId,
          candidateCommitment: current.state.candidateCommitment,
          registrationCommitment: current.state.registrationCommitment,
        },
        current,
      );
      const reg = current.state.registration;
      const selected = [];
      for (const stratum of reg.policy.strata) {
        const pool = reg.pool.filter((entry) => entry.stratum === stratum.id);
        const mandatory = pool
          .filter((entry) => reg.policy.mandatoryCaseIds.includes(entry.id))
          .map((entry) => entry.id);
        const optional = pool
          .filter((entry) => !reg.policy.mandatoryCaseIds.includes(entry.id))
          .map((entry) => entry.id);
        for (let i = optional.length - 1; i > 0; i--) {
          const j = adapterCall(() => this.#entropy.int(i + 1));
          requireThat(
            Number.isSafeInteger(j) && j >= 0 && j <= i,
            "ENTROPY_ERROR",
          );
          [optional[i], optional[j]] = [optional[j], optional[i]];
        }
        selected.push(
          ...mandatory,
          ...optional.slice(0, stratum.count - mandatory.length),
        );
      }
      const opening = this.#opening();
      const selectionCommitment = commitment("MMP-056-SELECTION-V1", opening, {
        drawId: request.drawId,
        selected,
        candidateCommitment: current.state.candidateCommitment,
        registrationCommitment: current.state.registrationCommitment,
      });
      this.#append(
        "SELECTION",
        { drawId: request.drawId, selected, opening, selectionCommitment },
        current,
      );
      return this.#receiptUnlocked();
    });
  }

  authorizeAttempt(request) {
    object(request, [
      "attemptId",
      "retryOf",
      "selectionReusable",
      "validUntil",
    ]);
    return this.#locked(() => {
      const current = this.#load();
      this.#append(
        "AUTHORIZE_ATTEMPT",
        {
          ...request,
          candidateCommitment: current.state.candidateCommitment,
          selectionCommitment: current.state.selectionCommitment,
        },
        current,
      );
      return this.#receiptUnlocked();
    });
  }

  startAttempt(request) {
    object(request, ["attemptId", "freeze", "authorizationHash"]);
    return this.#locked(() => {
      const current = this.#load();
      this.#append(
        "START_ATTEMPT",
        { ...request, selectionCommitment: current.state.selectionCommitment },
        current,
      );
      return this.#receiptUnlocked();
    });
  }

  recordBehavioralFail(request) {
    object(request, ["attemptId"]);
    return this.#locked(() => {
      const current = this.#load();
      this.#append("RECORD_BEHAVIORAL_FAIL", request, current);
      return this.#receiptUnlocked();
    });
  }

  finishAttempt(request) {
    object(request, [
      "attemptId",
      "freeze",
      "outcome",
      "errorClass",
      "executedCaseIds",
    ]);
    return this.#locked(() => {
      const current = this.#load();
      this.#append("FINISH_ATTEMPT", request, current);
      return this.#receiptUnlocked();
    });
  }

  abort(request) {
    object(request, ["reason"]);
    return this.#locked(() => {
      const current = this.#load();
      this.#append("ABORT", request, current);
      return this.#receiptUnlocked();
    });
  }

  // This is a synthetic-fixture helper, not an interface for real hidden cases.
  syntheticSelection() {
    return this.#locked(() => {
      const state = this.#load().state;
      requireThat(Array.isArray(state.selected), "SELECTION_UNAVAILABLE");
      return [...state.selected];
    });
  }

  #receiptUnlocked() {
    const { state, head, seq } = this.#load();
    return {
      format: "mmp-056-synthetic-receipt-v1",
      scope: "SYNTHETIC_ONLY",
      stage: `SYNTHETIC_${state.stage}`,
      epochId: state.registration?.epochId ?? null,
      registrationId: state.registration?.registrationId ?? null,
      runId: state.registration?.runId ?? null,
      custodyScopeId: state.registration?.custodyScopeId ?? null,
      registrationCommitment: state.registrationCommitment ?? null,
      candidateCommitment: state.candidateCommitment ?? null,
      selectionCommitment: state.selectionCommitment ?? null,
      witnessRef: head,
      sequence: seq,
      counts:
        state.registration?.policy.strata.map(({ id: stratumId, count }) => ({
          stratumId,
          count,
        })) ?? [],
      attempts: state.attempts.map(
        ({
          id: attemptId,
          outcome,
          behavioralFailSeen,
          terminalReceiptAt,
          terminalWitnessRef,
        }) => ({
          attemptId,
          outcome,
          behavioralFailSeen,
          terminalReceiptAt: terminalReceiptAt ?? null,
          terminalWitnessRef: terminalWitnessRef ?? null,
        }),
      ),
      g4Verdict: "INCONCLUSIVE",
      realAdmission: "NOT_AUTHORIZED",
    };
  }

  receipt() {
    return this.#locked(() => this.#receiptUnlocked());
  }

  syntheticEvidenceIdentity(attemptId) {
    id(attemptId);
    return this.#locked(() => {
      const { state } = this.#load();
      const attempt = state.attempts.find((entry) => entry.id === attemptId);
      requireThat(
        attempt?.terminalReceiptAt && attempt?.terminalWitnessRef,
        "TERMINAL_RECEIPT_REQUIRED",
      );
      return {
        format: "mmp-evidence-identity-v1",
        runId: state.registration.runId,
        epochId: state.registration.epochId,
        registrationCommitment: state.registrationCommitment,
        candidateCommitment: state.candidateCommitment,
        attemptId,
        terminalReceiptAt: attempt.terminalReceiptAt,
        witnessRef: attempt.terminalWitnessRef,
        custodyScopeId: state.registration.custodyScopeId,
      };
    });
  }
}

export function createSyntheticRegistry(config) {
  return new SyntheticRegistry(config, ENTROPY);
}

// Imported only by the package's tests. There is no real-admission entrypoint.
export function createSyntheticTestRegistry(config, entropy) {
  return new SyntheticRegistry(config, entropy);
}

export { checkpointMessage };
