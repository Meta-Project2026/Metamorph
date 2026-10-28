// Only projections of the fixed PUBLIC corpus. Never call this on an audit pack.
import {
  requireCheck,
  strictJson,
} from "../../packages/differential/src/strict.mjs";
import { digest } from "./driver.mjs";

// Original operators from pinned public api.php:103,113,119,254,345 and TS:29,81,86.
// Fixed diagnostic programs execute in the already isolated workers, never on host.
export const PHP_SEMANTICS = String.raw`parse_str('mechanic_id=1e1&phone=%2B1555%C2%A0440001&car_engine=ENG%C2%A0044A',$f); echo json_encode(['php'=>PHP_VERSION,'pcre'=>PCRE_VERSION,'integer'=>(int)$f['mechanic_id'],'phoneHex'=>bin2hex($f['phone']),'engineHex'=>bin2hex($f['car_engine']),'phoneMatch'=>(bool)preg_match('/^[0-9+\s\-()]{6,20}$/',$f['phone']),'engineMatch'=>(bool)preg_match('/^[a-zA-Z0-9\s\-]+$/',$f['car_engine'])],JSON_THROW_ON_ERROR);`;
export const JS_SEMANTICS = String.raw`const f=new URLSearchParams('mechanic_id=1e1&phone=%2B1555%C2%A0440001&car_engine=ENG%C2%A0044A');console.log(JSON.stringify({node:process.version,integer:Number.parseInt(f.get('mechanic_id'),10)||0,phoneHex:Buffer.from(f.get('phone')).toString('hex'),engineHex:Buffer.from(f.get('car_engine')).toString('hex'),phoneMatch:/^[0-9+\s\-()]{6,20}$/.test(f.get('phone')),engineMatch:/^[a-zA-Z0-9\s-]+$/.test(f.get('car_engine'))}));`;
export function publicSemantics(php, ts) {
  const shared = (r) =>
    Number.isSafeInteger(r.integer) &&
    r.integer >= 0 &&
    r.integer <= 100 &&
    r.phoneHex === "2b31353535c2a0343430303031" &&
    r.engineHex === "454e47c2a030343441" &&
    typeof r.phoneMatch === "boolean" &&
    typeof r.engineMatch === "boolean";
  requireCheck(
    Object.keys(php).sort().join() ===
      "engineHex,engineMatch,integer,pcre,phoneHex,phoneMatch,php" &&
      Object.keys(ts).sort().join() ===
        "engineHex,engineMatch,integer,node,phoneHex,phoneMatch" &&
      php.php === "7.4.33" &&
      /^\d{1,2}\.\d{1,2}(?:\.\d{1,2})? \d{4}-\d{2}-\d{2}$/.test(php.pcre) &&
      ts.node === "v24.11.0" &&
      shared(php) &&
      shared(ts),
    "OBSERVATION_ERROR",
  );
  return {
    reference: php,
    candidateLanguage: ts,
    scope: "FIXED_PUBLIC_OPERATOR_DIAGNOSTICS",
  };
}
function httpProjection(o) {
  const json = strictJson(Buffer.from(o.body).toString("utf8"), 256 * 1024);
  requireCheck(typeof json.success === "boolean", "OBSERVATION_ERROR");
  const result = {
    status: o.status,
    success: json.success,
    bodySha256: digest([...o.body]),
  };
  if (json.appointment_id !== undefined) {
    requireCheck(
      typeof json.appointment_id === "string" &&
        /^\d{1,4}$/.test(json.appointment_id),
      "OBSERVATION_ERROR",
    );
    result.appointmentId = json.appointment_id;
  }
  if (json.appointments !== undefined) {
    requireCheck(
      Array.isArray(json.appointments) && json.appointments.length <= 8,
      "OBSERVATION_ERROR",
    );
    result.appointmentCount = json.appointments.length;
  }
  // Messages and joined mechanic names never enter the public projection.
  return result;
}
function dbProjection(snapshot) {
  const appointments = snapshot.tables.find((t) => t.name === "appointments");
  const sequence = snapshot.tables.find((t) => t.name === "sqlite_sequence");
  requireCheck(
    appointments && appointments.rows.length <= 8 && sequence,
    "OBSERVATION_ERROR",
  );
  const select = (row, table, name) => row[table.columns.indexOf(name)];
  const rows = appointments.rows.map((row) => {
    const id = select(row, appointments, "id"),
      mechanic = select(row, appointments, "mechanic_id"),
      date = select(row, appointments, "appointment_date");
    requireCheck(
      [id, mechanic].every(
        (v) => v.type === "integer" && /^\d{1,4}$/.test(v.value),
      ) &&
        date.type === "text" &&
        ["2099-08-18", "2099-08-19", "2099-02-29", "2020-05-17"].includes(
          date.value,
        ),
      "OBSERVATION_ERROR",
    );
    return { id: id.value, mechanicId: mechanic.value, date: date.value };
  });
  const seq = sequence.rows.find(
    (row) => select(row, sequence, "name")?.value === "appointments",
  );
  const cell = seq ? select(seq, sequence, "seq") : null;
  requireCheck(
    cell === null || (cell.type === "integer" && /^\d{1,4}$/.test(cell.value)),
    "OBSERVATION_ERROR",
  );
  return {
    appointments: rows,
    appointmentSequence: cell?.value ?? null,
    fullSnapshotSha256: digest(snapshot),
  };
}
export function publicRecord(corpus, scenarioId, kind, value) {
  const scenario = corpus.cases.find((s) => s.id === scenarioId);
  requireCheck(scenario, "CORPUS_INVALID");
  const match = /^(http|db)-step-([1-8])$/.exec(kind);
  if (!match) return null;
  const request = scenario.requests[Number(match[2]) - 1];
  requireCheck(request, "COVERAGE_ERROR");
  const result = {
    scenarioId,
    stepId: `step-${match[2]}`,
    kind: match[1],
    requestSha256: digest(request),
  };
  if (match[1] === "http") {
    requireCheck(digest(value.request) === digest(request), "CORPUS_INVALID");
    const fromRaw = (raw) =>
      httpProjection({
        status: raw.status,
        body: Buffer.from(raw.bodyBase64, "base64"),
      });
    requireCheck(
      digest(fromRaw(value.php.raw)) ===
        digest(httpProjection(value.php.observation)) &&
        digest(fromRaw(value.rawTarget)) ===
          digest(httpProjection(value.mappedTarget)),
      "OBSERVATION_ERROR",
    );
    return {
      ...result,
      reference: httpProjection(value.php.observation),
      candidate: httpProjection(value.mappedTarget),
      rawReferenceSha256: digest(value.php.raw),
      rawCandidateSha256: digest(value.rawTarget),
    };
  }
  const rawPhp = strictJson(
    Buffer.from(value.php.raw.stateBase64, "base64").toString("utf8"),
  );
  const selectedRaw = (raw) =>
    dbProjection({
      tables: raw.tables.map((t) => ({
        name: t.name,
        columns: t.columns.map((c) => c.name),
        rows: t.rows,
      })),
    });
  for (const [raw, mapped] of [
    [rawPhp, value.php.snapshot],
    [value.rawTarget, value.mappedTarget],
  ]) {
    const left = selectedRaw(raw),
      right = dbProjection(mapped);
    requireCheck(
      digest(left.appointments) === digest(right.appointments) &&
        left.appointmentSequence === right.appointmentSequence,
      "OBSERVATION_ERROR",
    );
  }
  return {
    ...result,
    reference: dbProjection(value.php.snapshot),
    candidate: dbProjection(value.mappedTarget),
    rawReferenceSha256: digest(value.php.raw),
    rawCandidateSha256: digest(value.rawTarget),
  };
}
