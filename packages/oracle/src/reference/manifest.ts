import { createHash } from "node:crypto";
import type { ScenarioRequest } from "../runner.js";

export const SOURCE = Object.freeze({
  repository: "tanjilaafsarirubina/car-workshop",
  commit: "d272170d0aecbd28eb5b13e272d9dd11d545b66c",
  archiveSha256:
    "32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4",
  licenseSha256:
    "46ef5fb6b330816e097c9e7e16e5a4e6ba8f03c2113a4d97fe8c358f64d629a9",
  image:
    "php@sha256:620a6b9f4d4feef2210026172570465e9d0c1de79766418d3affd09190a7fda5",
  clock: "2026-10-27 12:00:00",
  initialSha256:
    "4dad8da4cd93e4a7386c75898113ede6e9875fe2adee9fb9d4482da0cae696fb",
});
export const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const get = (path: string): ScenarioRequest => ({ method: "GET", path });
const post = (
  action: string,
  form: Record<string, string>,
): ScenarioRequest => ({
  method: "POST",
  path: `/api.php?action=${action}`,
  body: new URLSearchParams(form).toString(),
});
const booking = (i: number) =>
  post("book", {
    client_name: `Public Qualification ${i}`,
    address: "Synthetic address",
    phone: `+15550000${i}`,
    car_license: `QUAL-${i}`,
    car_engine: `ENGINE-${i}`,
    appointment_date: "2099-06-15",
    mechanic_id: "1",
  });
const read = get("/api.php?action=get_appointments");
export const BOOTSTRAP = get("/api.php?action=get_slots&date=2099-06-15");
export const MANIFEST = Object.freeze(
  [
    {
      id: "workshop-business",
      requests: [
        booking(1),
        read,
        post("update_appointment", {
          id: "1",
          appointment_date: "2099-06-16",
          mechanic_id: "2",
        }),
        read,
        post("cancel_appointment", { id: "1" }),
        read,
      ],
    },
    {
      id: "workshop-rejected",
      requests: [booking(1), booking(1), read, post("book", {}), read],
    },
    {
      id: "workshop-capacity",
      requests: [
        booking(1),
        booking(2),
        booking(3),
        booking(4),
        booking(5),
        BOOTSTRAP,
      ],
    },
  ].map((scenario) =>
    Object.freeze({
      id: scenario.id,
      requests: Object.freeze(
        scenario.requests.map((request) => Object.freeze(request)),
      ),
    }),
  ),
);
export const MANIFEST_SHA256 = sha256(JSON.stringify(MANIFEST));
export const stepId = (index: number): string =>
  `step-${String(index + 1).padStart(2, "0")}`;

export class ReferenceWorkerError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ReferenceWorkerError";
  }
}
export function ensure(
  condition: unknown,
  code = "REFERENCE_INVALID",
): asserts condition {
  if (!condition) throw new ReferenceWorkerError(code);
}
