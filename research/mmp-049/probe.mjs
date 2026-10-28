// Trusted fixed operator probe. PHP and JS programs execute only inside Docker.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SOURCE } from "../../packages/oracle/dist/reference/manifest.js";
import {
  command,
  requireSuccess,
  sandboxArgs,
} from "../../packages/target-worker/src/controller.mjs";
import { atomic, finalize } from "../mmp-044/finalize.mjs";
import { inputMatrix } from "./inputs.mjs";

const root = new URL("../../", import.meta.url);
const headSha = process.env.MMP049_HEAD_SHA;
const parent = process.env.MMP049_PROBE_PARENT;
const output = process.env.MMP049_OUTPUT;
assert.equal(process.platform, "linux");
process.umask(0o077);
mkdirSync(parent, { mode: 0o700 });
mkdirSync(output, { recursive: true });
const names = { containers: [], volumes: [], prefixes: [] };
const nodeImage = readFileSync(
  new URL("packages/target-worker/runtime/Dockerfile", root),
  "utf8",
)
  .split("\n")[0]
  .slice(5)
  .trim();
const phpCode = String.raw`$m=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR); $out=['php'=>PHP_VERSION,'pcre'=>PCRE_VERSION,'intSize'=>PHP_INT_SIZE,'integers'=>[],'whitespace'=>[]]; foreach($m['integers'] as $s) $out['integers'][]=['input'=>$s,'cast'=>(string)(int)$s]; foreach($m['whitespace'] as $v) { $s=$v[1]; $out['whitespace'][]=['id'=>$v[0],'phone'=>(bool)preg_match('/^[0-9+\s\-()]{6,20}$/',trim('+1555'.$s.'440001')),'engine'=>(bool)preg_match('/^[a-zA-Z0-9\s\-]+$/',trim('ENG'.$s.'049A')),'edgePhone'=>(bool)preg_match('/^[0-9+\s\-()]{6,20}$/',trim($s.'+1555440001'.$s))]; } echo json_encode($out,JSON_THROW_ON_ERROR);`;
const jsCode = String.raw`let b='';for await(const c of process.stdin)b+=c;const m=JSON.parse(b);const trim=s=>{s=s??'';const c=' \t\n\r\0\v';let a=0,z=s.length;while(a<z&&c.includes(s[a]))a++;while(z>a&&c.includes(s[z-1]))z--;return s.slice(a,z)};console.log(JSON.stringify({node:process.version,integers:m.integers.map(s=>({input:s,cast:String(Number.parseInt(trim(s),10)||0)})),whitespace:m.whitespace.map(([id,s])=>({id,phone:/^[0-9+\s\-()]{6,20}$/.test(trim('+1555'+s+'440001')),engine:/^[a-zA-Z0-9\s-]+$/.test(trim('ENG'+s+'049A')),edgePhone:/^[0-9+\s\-()]{6,20}$/.test(trim(s+'+1555440001'+s))}))}));`;
let failure = null;
let measurements;
try {
  const values = [];
  for (const [image, program] of [
    [SOURCE.image, ["php", "-r", phpCode]],
    [nodeImage, ["node", "--input-type=module", "-e", jsCode]],
  ]) {
    requireSuccess(await command(["pull", image], { timeoutMs: 120000 }));
    const name = `mmp-reference-${randomUUID()}`;
    names.containers.push(name);
    atomic(join(parent, "resources.json"), names);
    const result = requireSuccess(
      await command(
        [
          "run",
          "--rm",
          "-i",
          ...sandboxArgs(name),
          "--user",
          "65534:65534",
          image,
          ...program,
        ],
        { input: JSON.stringify(inputMatrix), timeoutMs: 30000 },
      ),
    );
    values.push(JSON.parse(result.stdout));
  }
  assert.equal(values[0].php, "7.4.33");
  assert.equal(values[0].intSize, 8);
  assert.equal(values[1].node, "v24.11.0");
  measurements = { php: values[0], frozenTsOperators: values[1] };
} catch (error) {
  failure = error.code ?? "PROBE_ERROR";
} finally {
  const cleanup = await finalize(parent);
  atomic(join(output, "semantics.json"), {
    format: "mmp049-public-semantics-v1",
    headSha,
    scope: "PUBLIC_OPERATORS_ONLY",
    status: failure ? "ERROR" : "PASS",
    images: { php: SOURCE.image, node: nodeImage },
    inputMatrix,
    measurements,
    errorCode: failure,
    cleanup,
  });
  assert.equal(cleanup.status, "PASS");
}
assert.equal(failure, null);
console.log(
  "Pinned isolated PHP/JS operator measurements complete; see semantics.json.",
);
