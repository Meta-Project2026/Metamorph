// Trusted Linux adapter. Join the whole process group, not just its first PID.
import { spawn } from "node:child_process";
import { insist } from "./migration-context.mjs";

export function spawnJoinedProcess(
  executable,
  args,
  { env, cwd, killAfterMs = 20000 },
) {
  insist(
    process.platform === "linux" &&
      Number.isInteger(killAfterMs) &&
      killAfterMs > 0 &&
      killAfterMs <= 20000,
    "CONFIG_DENIED",
  );
  const child = spawn(executable, args, {
    env,
    cwd,
    detached: true,
    stdio: "ignore",
  });
  let timer,
    interval,
    failed = false,
    stopping = false;
  const groupAlive = () => {
    if (!child.pid) return false;
    try {
      process.kill(-child.pid, 0);
      return true;
    } catch (error) {
      return error.code !== "ESRCH";
    }
  };
  const killGroup = (signal) => {
    if (!child.pid) return;
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== "ESRCH") failed = true;
    }
  };
  child.on("error", () => {
    failed = true;
  });
  const closed = new Promise((resolve) => {
    child.once("close", (exitCode, signal) => {
      const finished = () => {
        if (groupAlive()) return;
        clearInterval(interval);
        clearTimeout(timer);
        resolve({ exitCode, signal, failed, stopped: stopping });
      };
      interval = setInterval(finished, 20);
      finished();
    });
  });
  return Object.freeze({
    closed,
    stop() {
      if (stopping) return;
      stopping = true;
      killGroup("SIGTERM");
      timer = setTimeout(() => killGroup("SIGKILL"), killAfterMs);
    },
  });
}
