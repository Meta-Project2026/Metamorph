// MMP-146: one owner-local resumed public Oracle attempt after the previous
// run produced zero candidate attempts because trusted provenance was blocked. This helper contains no candidate source and never sends it
// anywhere. Only the repository's existing trusted Docker verifier executes
// candidate JS; never import candidate text into this Node process.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REVIEWED_HEAD = 'f68b75ec0005cb76059f41218452ff57f47d50d6';
const DERIVATIVE_SHA = 'b5322f21b1cc3b2df34ecffada8a599f6537f2417136a548207e2b08eb620a67';
const ROOT = resolve(process.cwd());
const DERIVATIVE = join(homedir(), '.local/share/metamorph-candidate-derivative/41505679809');
const PRIVATE_PARENT = join(homedir(), '.local/share/metamorph-public-oracle');
const PREVIOUS_RUN = join(PRIVATE_PARENT, '41505679809-derivative-b5322f21');
const PRIVATE_RUN = join(PRIVATE_PARENT, '41505679809-derivative-b5322f21-resume-01');
const PUBLIC_ARCHIVE = 'https://codeload.github.com/tanjilaafsarirubina/car-workshop/tar.gz/d272170d0aecbd28eb5b13e272d9dd11d545b66c';
const CREDENTIAL_VARS = [
  'CI', 'MODEL_API_KEY', 'META_API_KEY', 'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY',
  'GH_TOKEN', 'GITHUB_TOKEN', 'ACTIONS_RUNTIME_TOKEN',
  'ACTIONS_ID_TOKEN_REQUEST_TOKEN', 'ACTIONS_CACHE_SERVICE_TOKEN',
];
const refuse = (reason) => { throw new Error(reason); };
const allClean = (p) => {
  assert.equal(realpathSync(p), p, 'LINK_OR_NONCANONICAL_PATH');
  assert.equal(lstatSync(p).isSymbolicLink(), false, 'SYMLINK');
  const stat = statSync(p);
  assert.equal(stat.uid, process.getuid(), 'WRONG_OWNER');
  assert.equal(stat.mode & 0o077, 0, 'UNSAFE_PERMISSIONS');
};
function gateView(gate) {
  const g = gate ?? {};
  return {
    verdict: typeof g.verdict === 'string' ? g.verdict : 'NOT_RUN',
    executed: Array.isArray(g.executedTestIds) ? g.executedTestIds.length : 0,
    findingCodes: Array.isArray(g.findingCodes)
      ? g.findingCodes.filter(x => typeof x === 'string').sort()
      : [],
  };
}

let phase = 'PRECHECK';
try {
  process.umask(0o077);
  assert.equal(process.platform, 'linux', 'WSL_LINUX_ONLY');
  assert.equal(process.arch, 'x64', 'AMD64_ONLY');
  assert.equal(CREDENTIAL_VARS.every(name => !process.env[name]), true, 'CREDENTIAL_ENV_REFUSED');
  assert.equal(ROOT, realpathSync(ROOT), 'REPO_LINK');
  assert.equal(execFileSync('git', ['rev-parse','HEAD'], {cwd:ROOT,encoding:'utf8'}).trim(), REVIEWED_HEAD, 'REVIEWED_SHA_MISMATCH');
  assert.equal(execFileSync('git', ['status','--porcelain'], {cwd:ROOT,encoding:'utf8'}).trim(), '', 'DIRTY_REPOSITORY');
  assert.equal(existsSync(join(ROOT,'packages/oracle/dist/index.js')), true, 'TRUSTED_BUILD_MISSING');
  // pnpm workspace links direct dependencies inside the consumer package, not the root.
  assert.equal(existsSync(join(ROOT,'packages/agent-real/node_modules/@metamorph/agent/package.json')), true, 'DEPENDENCIES_MISSING');
  assert.equal(existsSync(PRIVATE_RUN), false, 'PRIVATE_RESULT_EXISTS');
  // Permit this replacement attempt only if the earlier owner's private receipt
  // proves that no candidate scenarios were ever started and cleanup was verified.
  allClean(PREVIOUS_RUN);
  const previous = JSON.parse(readFileSync(join(PREVIOUS_RUN, 'summary-mmp146.json'), 'utf8'));
  assert.equal(previous.reviewedHead, REVIEWED_HEAD, 'PREVIOUS_HEAD_MISMATCH');
  assert.equal(previous.derivativeSha, DERIVATIVE_SHA, 'PREVIOUS_DERIVATIVE_MISMATCH');
  assert.equal(previous.attempts, 0, 'PREVIOUS_ATTEMPT_ALREADY_EXECUTED');
  assert.equal(previous.publicG1, 'NOT_RUN', 'PREVIOUS_G1_NOT_EMPTY');
  assert.equal(previous.publicG2, 'NOT_RUN', 'PREVIOUS_G2_NOT_EMPTY');
  assert.equal(previous.publicG3, 'NOT_RUN', 'PREVIOUS_G3_NOT_EMPTY');
  assert.equal(previous.cleanup?.status, 'VERIFIED_ZERO_RESOURCES', 'PREVIOUS_CLEANUP_INCOMPLETE');
  assert.equal(previous.cleanup?.containers, 0, 'PREVIOUS_CONTAINERS');
  assert.equal(previous.cleanup?.volumes, 0, 'PREVIOUS_VOLUMES');
  assert.equal(existsSync(PRIVATE_PARENT), true, 'PRIVATE_PARENT_MISSING');
  allClean(PRIVATE_PARENT);
  allClean(DERIVATIVE);
  allClean(join(DERIVATIVE, 'src'));
  // Docker COPY preserves mode bits; trusted scripts must be readable by UID 10001.
  const trustedRuntime = join(ROOT, 'packages/target-worker/runtime');
  for (const name of readdirSync(trustedRuntime).filter(n => n.endsWith('.mjs') ||
      n === 'package.json' || n === 'package-lock.json')) {
    assert.equal(statSync(join(trustedRuntime, name)).mode & 0o004, 0o004, 'TRUSTED_FILE_PERMISSION');
  }
  assert.equal(statSync(join(ROOT, 'packages/oracle/reference/inspector.php')).mode & 0o004,
    0o004, 'TRUSTED_INSPECTOR_PERMISSION');
  const server = JSON.parse(execFileSync('docker', ['version', '--format','{{json .Server}}'], {
    encoding:'utf8', timeout:30000, stdio:['ignore','pipe','pipe']
  }));
  assert.equal(server.Os, 'linux', 'DOCKER_LINUX_REQUIRED');
  assert.equal(server.Arch, 'amd64', 'DOCKER_AMD64_REQUIRED');
  // The existing trusted Resources ledger has a broad historical
  // 'mmp007-provenance-' cleanup prefix. Refuse a concurrent/preexisting
  // namespace instead of risking cleanup of another user's resources.
  const existingNames = execFileSync('docker',
    ['container', 'ls', '--all', '--format', '{{.Names}}'],
    {encoding:'utf8', timeout:30000, stdio:['ignore','pipe','pipe']}
  ).trim().split(/\s+/).filter(Boolean);
  assert.equal(existingNames.some(name =>
    /^(mmp007-provenance-|mmp-reference-|mmp-inspector-)/.test(name)
  ), false, 'SHARED_METAMORPH_CONTAINERS_PRESENT');
  const existingVolumes = execFileSync('docker',
    ['volume', 'ls', '--format', '{{.Name}}'],
    {encoding:'utf8', timeout:30000, stdio:['ignore','pipe','pipe']}
  ).trim().split(/\s+/).filter(Boolean);
  assert.equal(existingVolumes.some(name =>
    /^(mmp007-|mmp-reference-state-)/.test(name)
  ), false, 'SHARED_METAMORPH_VOLUMES_PRESENT');

  phase = 'ADMISSION';
  const trusted = async relativePath => import(pathToFileURL(join(ROOT,relativePath)).href);
  const { admitDirectory } = await trusted('packages/target-worker/src/admission.mjs');
  const bundle = await admitDirectory(DERIVATIVE, DERIVATIVE_SHA);
  assert.equal(bundle.candidateSha, DERIVATIVE_SHA, 'DERIVATIVE_SHA_MISMATCH');
  assert.deepEqual(bundle.files.map(f=>f.path), ['src/db.ts','src/handlers.ts','src/main.ts','src/util.ts']);
  for (const f of bundle.files) assert.equal(f.content.includes('MIT License'), true, 'MIT_LICENSE_MISSING');
  const { bindMigrationContext } = await trusted('packages/agent-real/src/migration-context.mjs');
  const { validateGeneratedMigration } = await trusted('packages/agent-real/src/migration-trial.mjs');
  const context = bindMigrationContext(readFileSync(join(ROOT,'research/mmp-061/public-source.json'),'utf8'));
  // Exactly one approved host fetch target. Docker CLI may separately fetch
  // only the production verifier's pinned container image dependencies.
  const originalFetch = globalThis.fetch;
  let publicSourceFetchCount = 0;
  globalThis.fetch = (input, init) => {
    if (String(input) !== PUBLIC_ARCHIVE) refuse('UNEXPECTED_HOST_FETCH');
    publicSourceFetchCount += 1;
    return originalFetch(input, init);
  };

  mkdirSync(PRIVATE_RUN, {mode:0o700});
  allClean(PRIVATE_RUN);
  console.log('PREFLIGHT=PASS');
  console.log('DERIVATIVE_ADMISSION=MATCH');
  console.log('EXECUTION=ONE_LOCAL_PUBLIC_ORACLE_RESUME_AFTER_ZERO_ATTEMPTS');

  phase = 'ORACLE';
  let result;
  try {
    result = await validateGeneratedMigration({
      context, root:ROOT, parent:PRIVATE_RUN,
      headSha:REVIEWED_HEAD,
      candidateRoot:DERIVATIVE, candidateSha:DERIVATIVE_SHA,
      signal:AbortSignal.timeout(20*60*1000),
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  const attempt = result.attempts?.[0];
  const gates = Object.fromEntries((attempt?.gates ?? []).map(g=>[g.gate,g]));
  const report = {
    format: 'mmp146-owner-local-public-derivative-resume-v1',
    previousRun: 'ZERO_CANDIDATE_ATTEMPTS_CLEANED',
    reviewedHead: REVIEWED_HEAD,
    derivativeSha:DERIVATIVE_SHA,
    execution:'ONE_DERIVATIVE_PUBLIC_RESUME_NO_PROVIDER',
    modelRequests:0,
    publicSourceFetchCount,
    attempts:result.attempts?.length ?? 0,
    scenarios:attempt?.pairs?.map(p=>p.scenarioId) ?? [],
    G1:gateView(gates.G1), G2:gateView(gates.G2),
    G3:gateView(gates.G3), G4:gateView(gates.G4),
    publicG1:result.publicG1,publicG2:result.publicG2,
    publicG3:result.publicG3,
    coverage:attempt?.coverage ?? null,
    cleanup:result.cleanup,
    blockers:result.blockers,
    historicalPaidResult:'UNCHANGED_G2_G3_FAIL',
    productStatus:'NOT_ESTABLISHED_UNTIL_INDEPENDENT_DERIVATIVE_REVIEW',
  };
  // Metadata-only sanitized report, NOT the raw HTTP/DB/Oracle packs.
  writeFileSync(join(PRIVATE_RUN,'summary-mmp146.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify(report,null,2));
  // Cleanup alone is not a parity verdict. Fail closed on zero attempts,
  // incomplete public coverage, any gate failure or unsuccessful resource cleanup.
  process.exitCode = result.attempts?.length === 1 &&
    attempt?.pairs?.length === 3 &&
    result.publicG1 === 'PASS' && result.publicG2 === 'PASS' &&
    result.publicG3 === 'PASS' &&
    attempt.coverage?.http === 17 && attempt.coverage?.sqlite === 20 &&
    result.cleanup?.status === 'VERIFIED_ZERO_RESOURCES' ? 0 : 2;
} catch {
  // Keep private paths, build compiler diagnostics and Oracle observations
  // out of stdout/stderr and chat. Any incomplete cleanup needs inspection.
  console.error(`MMP146_LOCAL_ERROR_STAGE=${phase}; do not retry automatically`);
  process.exitCode = 3;
}
