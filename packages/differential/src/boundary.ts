import type { WorkerAdapter } from "@metamorph/oracle";
/** Local bridge contract; executable MJS is verified by boundary/negative tests. */
export interface TargetOracleAdapter extends WorkerAdapter {
  provision(signal: AbortSignal): Promise<void>;
  readonly failure: {
    operationCode: string;
    cleanupCode: string | null;
  } | null;
  readonly stats: { resets: number; requests: number; snapshots: number };
}
