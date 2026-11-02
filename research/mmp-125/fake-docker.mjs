// Original test-only CLI. It never imports, resolves or executes Docker.
import { spawn } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const [configPath, ...args] = process.argv.slice(2);
const config = JSON.parse(readFileSync(configPath, "utf8"));
if (config.kind !== "MMP125_SYNTHETIC_PROCESS_FIXTURE") process.exit(97);
if (args[0] === "descendant") {
  setInterval(() => {}, 1000);
} else {
  const statePath = join(config.root, "state.json");
  const state = existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, "utf8"))
    : { volumes: {}, container: null, started: false, id: null, head: null };
  const save = () => writeFileSync(statePath, JSON.stringify(state));
  appendFileSync(join(config.root, "calls.jsonl"), `${JSON.stringify(args)}\n`);
  appendFileSync(join(config.root, "pids.jsonl"), `${process.pid}\n`);
  const is = (...prefix) => prefix.every((v, i) => args[i] === v);
  const foreign = "mmp-reference-11111111-1111-1111-1111-111111111111";
  const mode = config.mode;
  const emit = (value) => process.stdout.write(JSON.stringify(value));
  const hang = () => {
    process.stderr.write(config.canary);
    if (config.descendant) {
      const child = spawn(
        process.execPath,
        [fileURLToPath(import.meta.url), configPath, "descendant"],
        { stdio: "inherit", windowsHide: true },
      );
      appendFileSync(join(config.root, "pids.jsonl"), `${child.pid}\n`);
    }
    setInterval(() => {}, 1000);
  };
  if (mode === "version-fail") {
    process.stderr.write(config.canary);
    process.exit(1);
  }
  if (
    (mode === "hang-version" && is("version")) ||
    (mode === "hang-image" && is("image")) ||
    (mode === "hang-poll" && is("inspect", "--format")) ||
    (mode === "hang-cleanup" && is("rm")) ||
    (mode === "hang-final" &&
      is("container", "ls") &&
      state.started &&
      !state.container &&
      Object.keys(state.volumes).length === 0) ||
    is("hang")
  )
    hang();
  else if (mode === "output-limit" || is("overflow")) {
    process.stdout.write(config.canary.repeat(100000));
    setInterval(() => {}, 1000);
  } else if (is("echo")) emit(args.slice(1));
  else if (is("version")) emit({ Os: "linux", Arch: "amd64" });
  else if (is("image", "inspect"))
    emit([{ Id: args[2], Os: "linux", Architecture: "amd64" }]);
  else if (is("container", "ls")) {
    if (mode === "unknown-inventory") process.stdout.write("not/a/name");
    else
      process.stdout.write(
        [
          state.container,
          mode === "foreign-worker" ||
          (state.started && ["stale-ledger", "unknown-workers"].includes(mode))
            ? foreign
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
  } else if (is("volume", "ls")) {
    process.stdout.write(
      args.includes("--quiet") ? "" : Object.keys(state.volumes).join("\n"),
    );
  } else if (is("volume", "create")) {
    state.volumes[args.at(-1)] =
      args[args.indexOf("--label") + 1].split("=")[1];
    save();
    process.stdout.write(args.at(-1));
  } else if (is("volume", "inspect")) {
    const name = args[2];
    if (!(name in state.volumes)) process.exit(1);
    emit([
      {
        Labels: {
          "metamorph.mmp125.run":
            mode === "wrong-volume-owner" ? "FOREIGN" : state.volumes[name],
        },
        Mountpoint: `/var/lib/docker/volumes/${name}/_data`,
      },
    ]);
  } else if (is("run")) {
    state.container = args[args.indexOf("--name") + 1];
    state.started = true;
    const env = Object.fromEntries(
      args.flatMap((a, i) =>
        a === "-e"
          ? [
              [
                args[i + 1].slice(0, args[i + 1].indexOf("=")),
                args[i + 1].slice(args[i + 1].indexOf("=") + 1),
              ],
            ]
          : [],
      ),
    );
    state.id = env.MMP125_ID;
    state.head = env.MMP125_HEAD;
    save();
    process.stdout.write("SYNTHETIC_CONTAINER");
  } else if (is("inspect", "--format")) emit({ Running: false, ExitCode: 0 });
  else if (is("inspect")) {
    if (state.container !== args[1]) process.exit(1);
    emit([
      {
        Config: {
          Labels: {
            "metamorph.mmp125.run":
              mode === "foreign-outer-owner" ? "FOREIGN" : state.id,
          },
        },
      },
    ]);
  } else if (is("cp")) {
    const data = args[1].endsWith("/ownership.json")
      ? {
          format: "mmp125-private-ownership-v1",
          diagnosticId: mode === "stale-ledger" ? "foreign" : state.id,
          containers: [],
          volumes: [],
          prefixes: [],
        }
      : {
          diagnosticId: state.id,
          headSha: state.head,
          status: "SYNTHETIC_ONLY",
        };
    writeFileSync(args[2], JSON.stringify(data));
  } else if (is("rm")) {
    if (args.at(-1) !== state.container) process.exit(98);
    state.container = null;
    save();
  } else if (is("volume", "rm")) {
    delete state.volumes[args[2]];
    save();
  } else {
    process.stderr.write(config.canary);
    process.exit(96);
  }
}
