// Trusted negative driver. Every supplied TS program is compiled/run ONLY in Docker.
import { WORKSHOP_PROFILE } from "../../target-worker/runtime/profile.mjs";
import { sha256, validateBundle } from "../../target-worker/src/admission.mjs";
import { command, TargetWorker } from "../../target-worker/src/controller.mjs";
import { requireCheck } from "./strict.mjs";

export const WORKSHOP_CONTROL_IDS = Object.freeze([
  "candidate-aux-enospc",
  "candidate-wal-full",
  "corrupt-db-rejected",
  "hung-socket-timeout",
  "process-crash",
  "cancel-readiness",
]);
const make = (source) =>
  validateBundle([
    { path: "src/main.ts", content: source, sha256: sha256(source) },
  ]);
const base = `import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {openSync,closeSync,writeSync,writeFileSync,statfsSync,unlinkSync} from 'node:fs';
const db=new DatabaseSync('/state/target.sqlite'); db.exec('CREATE TABLE original(value TEXT)');
`;
export async function workshopControls(runtime, ledger, record, signal) {
  const results = [];
  for (const id of WORKSHOP_CONTROL_IDS) {
    const mode = id === "candidate-aux-enospc" ? "aux" : "wal";
    const overflow = `const mode=String('${mode}'); const mount=statfsSync('/state'); let written=0,code='';
      if(mount.type!==0x01021994||mount.blocks*mount.bsize!==16777216) throw Error('QUOTA');
      let fd: number|undefined, fill: DatabaseSync|undefined;
      try { if(mode==='aux') { fd=openSync('/state/aux','wx'); while(written<=17825792) written+=writeSync(fd,Buffer.alloc(65536)); }
      else { fill=new DatabaseSync('/state/fill.sqlite'); fill.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE fill(v BLOB)'); const q=fill.prepare('INSERT INTO fill VALUES(zeroblob(65536))'); while(written<=17825792){q.run();written+=65536;} }
      } catch(e) { const err=e as {code?:string;errcode?:number}; code=mode==='aux'?(err.code??'OTHER'):(err.errcode===13?'SQLITE_FULL':'OTHER'); }
      finally { if(fd!==undefined)closeSync(fd); fill?.close(); }
      for(const p of ['aux','fill.sqlite','fill.sqlite-wal','fill.sqlite-shm']){try{unlinkSync('/state/'+p);}catch{}}
      res.end(JSON.stringify({code,written}));`;
    const handler = id.startsWith("candidate-")
      ? overflow
      : "writeFileSync('/state/target.sqlite',Buffer.alloc(8192,0x61)); res.end('{}');";
    const source =
      id === "hung-socket-timeout" || id === "cancel-readiness"
        ? `${base}setInterval(()=>{},1000);`
        : id === "process-crash"
          ? `${base}process.exit(1);`
          : `${base}createServer((req,res)=>{res.setHeader('x-request-id',req.headers['x-request-id']??'');res.setHeader('content-type','application/json; charset=utf-8');${handler}}).listen(3000,'127.0.0.1');`;
    const cancel = new AbortController();
    const worker = new TargetWorker(runtime, make(source), "real", {
      profile: WORKSHOP_PROFILE,
      limits: { startupTimeoutMs: 2500 },
      ...(id === "cancel-readiness"
        ? {
            trustedTest: {
              command: async (args, config) => {
                const receipt = await command(args, config);
                if (
                  args.includes("/opt/worker/inspect.mjs") &&
                  JSON.parse(args.at(-1)).kind === "readiness"
                )
                  cancel.abort();
                return receipt;
              },
            },
          }
        : {}),
    });
    ledger.target(worker.runId);
    let error;
    try {
      await worker.provision(AbortSignal.any([signal, cancel.signal]));
      if (id.startsWith("candidate-")) {
        const receipt = await worker.request(
          "overflow",
          "POST",
          "/api.php?action=book",
          "",
          signal,
        );
        const value = JSON.parse(
          Buffer.from(receipt.bodyBase64, "base64").toString(),
        );
        requireCheck(
          value.code === (mode === "aux" ? "ENOSPC" : "SQLITE_FULL") &&
            value.written > 0 &&
            value.written <= 16777216,
          "QUOTA_CONTROL",
        );
        await worker.snapshot("valid-after-overflow", signal);
      } else if (id === "corrupt-db-rejected") {
        await worker.request(
          "corrupt",
          "POST",
          "/api.php?action=book",
          "",
          signal,
        );
        await worker.snapshot("reject-corruption", signal);
      }
    } catch (e) {
      error = e;
    } finally {
      await worker.close();
      record("workshop-control", {
        id,
        evidence: worker.evidence,
        error: error?.message,
      });
    }
    const expected = id.startsWith("candidate-")
      ? null
      : id === "corrupt-db-rejected"
        ? "OBSERVATION_ERROR"
        : id === "hung-socket-timeout"
          ? "TIMEOUT"
          : id === "process-crash"
            ? "RUNTIME_FAILED"
            : "CANCELLED";
    requireCheck(
      expected ? error?.message?.startsWith(expected) : !error,
      "WORKSHOP_CONTROL",
    );
    requireCheck(worker.evidence.cleanupVerified, "CLEANUP_ERROR");
    results.push({ id, outcome: "PASS", cleanup: "VERIFIED_ZERO_RESOURCES" });
  }
  return results;
}
