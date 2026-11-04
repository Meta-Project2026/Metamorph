// Fixed trusted programs run only inside Docker. They publish booleans/codes.
export const PERMISSIONS = Object.freeze([
  "--max-old-space-size=96",
  "--permission",
  "--allow-fs-read=/work/out/",
  "--allow-fs-read=/state/",
  "--allow-fs-write=/state/",
]);
export const DENIAL_PROBE = `
const fs = require('node:fs');
const net = require('node:net');
const cp = require('node:child_process');
const denied = (fn, code = 'ERR_ACCESS_DENIED') => { try { fn(); return false; } catch(e) { return e.code === code; } };
const socketDenied = (options) => new Promise(resolve => {
  let s;
  try { s = net.createConnection(options); } catch(e) { resolve(e.code === 'ERR_ACCESS_DENIED'); return; }
  const timer = setTimeout(() => { s.destroy(); resolve(false); }, 1000);
  s.once('connect', () => { clearTimeout(timer); s.destroy(); resolve(false); });
  s.once('error', e => { clearTimeout(timer); resolve(['ENETUNREACH','EHOSTUNREACH','EACCES','EPERM','ECONNREFUSED','ERR_ACCESS_DENIED', ...(options.path ? ['ENOENT'] : [])].includes(e.code)); });
});
(async () => {
const result = {
 filesystem: denied(() => fs.readFileSync('/etc/passwd')),
 php: denied(() => cp.spawnSync('/usr/bin/php', ['-v'])),
 reference: denied(() => fs.readFileSync('/reference/source.php')) && await socketDenied({host:'127.0.0.1',port:9000}),
 corpus: denied(() => fs.readdirSync('/corpus')),
 docker: denied(() => fs.readFileSync('/var/run/docker.sock')),
 spawn: denied(() => cp.spawnSync('/usr/local/bin/node', ['-e','process.exit(0)'])),
 native: denied(() => process.dlopen({}, '/tmp/foreign.node'), 'ERR_DLOPEN_DISABLED'),
 network: await socketDenied({host:'198.51.100.1',port:80}),
 ipc: await socketDenied({path:'/var/run/docker.sock'}),
};
console.log(JSON.stringify(result));
})();`;

// Unsandboxed trusted observer in the runtime namespace. Candidate code is never
// imported. Host inspect independently checks mount origins and namespace modes.
export const PROCESS_PROBE = String.raw`
const fs = require('node:fs');
const os = require('node:os');
const absent = ['/usr/bin/php','/usr/local/bin/php','/reference','/oracle','/corpus','/var/run/docker.sock','/run/docker.sock']
  .every(p => !fs.existsSync(p));
const processes = fs.readdirSync('/proc').filter(x => /^[0-9]+$/.test(x)).flatMap(pid => {
  try { return [{pid, args: fs.readFileSync('/proc/'+pid+'/cmdline','utf8').split('\0').filter(Boolean)}]; } catch { return []; }
});
const candidate = processes.filter(p => p.args.includes('/work/out/main.js'));
const flags = ['--permission','--allow-fs-read=/work/out/','--allow-fs-read=/state/','--allow-fs-write=/state/'];
const processOk = candidate.length === 1 && flags.every(f => candidate[0].args.includes(f)) &&
  processes.every(p => !p.args.some(a => /(?:^|\/)php(?:[0-9.]*)$/.test(a)));
let environment = false;
if (candidate.length === 1) {
  try {
    const entries = fs.readFileSync('/proc/'+candidate[0].pid+'/environ','utf8').split('\0').filter(Boolean);
    environment = entries.length === 2 && entries.includes('TZ=UTC') && entries.includes('PATH=/usr/local/bin:/usr/bin:/bin');
  } catch {}
}
const routes = fs.readFileSync('/proc/net/route','utf8').trim().split('\n').slice(1);
const mounts = fs.readFileSync('/proc/self/mountinfo','utf8').trim().split('\n').map(l => l.split(' '));
const rootReadonly = mounts.some(m => m[4] === '/' && m[5].split(',').includes('ro'));
const tmpfsBounds = [['/work',67108864],['/state',16777216],['/tmp',16777216]].every(([path,limit]) => {
  const s = fs.statfsSync(path), m = mounts.find(m => m[4] === path);
  return s.type === 0x01021994 && s.blocks*s.bsize === limit && m &&
    ['nosuid','nodev', ...(path === '/work' ? [] : ['noexec'])].every(f => m[5].split(',').includes(f));
});
const cgroup = '/sys/fs/cgroup/';
let bounds = false;
try {
  const read = p => fs.readFileSync(cgroup+p,'utf8').trim();
  const cpu = read('cpu.max').split(/\s+/).map(Number);
  bounds = read('memory.max') === '268435456' && read('memory.swap.max') === '0' &&
    read('pids.max') === '64' && cpu.length === 2 && cpu[0] > 0 && cpu[0] === cpu[1] && tmpfsBounds && rootReadonly;
} catch {}
let privileges = false;
if (candidate.length === 1) {
  const status = fs.readFileSync('/proc/'+candidate[0].pid+'/status','utf8');
  privileges = /^Uid:\s+10001\s+10001\s+10001\s+10001$/m.test(status) &&
    /^CapEff:\s+0+$/m.test(status) && /^NoNewPrivs:\s+1$/m.test(status) && /^Seccomp:\s+2$/m.test(status);
}
const namespace = Object.keys(os.networkInterfaces()).every(x => x === 'lo') && routes.length === 0 &&
  fs.readlinkSync('/proc/self/ns/pid').startsWith('pid:[') &&
  fs.readlinkSync('/proc/self/ns/net').startsWith('net:[');
console.log(JSON.stringify({absent, process:processOk, environment, namespace, bounds, privileges}));`;
