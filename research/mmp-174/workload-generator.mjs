// Deterministic, public, in-memory synthetic workload generator for MMP-174.
// Never derived from private candidate code, Oracle fixtures, or held-out tests.
// Generates bounded, compilable TypeScript modules conforming to TargetWorker admission rules.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateBundle } from "../../packages/target-worker/src/admission.mjs";

export const TIERS = Object.freeze(["baseline", "moderate", "heavy"]);

export const TIER_CONFIGS = Object.freeze({
  baseline: Object.freeze({
    tier: "baseline",
    moduleCount: 0,
    description: "Immutable public workshop fixture (src/main.ts and src/schema.ts) unchanged",
  }),
  moderate: Object.freeze({
    tier: "moderate",
    moduleCount: 6,
    description: "Baseline plus 6 synthetic TS modules (mod_01..mod_06, ~16 KiB added source)",
  }),
  heavy: Object.freeze({
    tier: "heavy",
    moduleCount: 24,
    description: "Baseline plus 24 synthetic TS modules (mod_01..mod_24, ~48 KiB added source)",
  }),
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function loadBaselineFiles(workshopRoot) {
  const mainPath = join(workshopRoot, "src/main.ts");
  const schemaPath = join(workshopRoot, "src/schema.ts");
  const mainContent = readFileSync(mainPath, "utf8");
  const schemaContent = readFileSync(schemaPath, "utf8");

  return [
    {
      path: "src/main.ts",
      sha256: sha256(mainContent),
      content: mainContent,
    },
    {
      path: "src/schema.ts",
      sha256: sha256(schemaContent),
      content: schemaContent,
    },
  ];
}

// 24 deterministic, strictly typed TS modules forming a strict DAG.
// All relative imports use .js extension per TypeScript NodeNext module resolution.
const SYNTHETIC_MODULE_TEMPLATES = [
  // 1: Core functional types & primitives
  `// mod_01.ts - Core functional types and primitives
export type Brand<K, T> = K & { readonly __brand: T };
export type EntityId<T extends string> = Brand<string, T>;
export type Timestamp = Brand<number, "Timestamp">;

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export type Option<T> =
  | { readonly some: true; readonly value: T }
  | { readonly some: false };

export interface PaginationQuery {
  readonly offset: number;
  readonly limit: number;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

export type SortOrder = "asc" | "desc";

export interface SortSpec<T> {
  readonly field: keyof T;
  readonly order: SortOrder;
}

export type DeepReadonly<T> = T extends (infer R)[]
  ? ReadonlyArray<DeepReadonly<R>>
  : T extends Function
  ? T
  : T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

export type NonEmptyArray<T> = readonly [T, ...T[]];

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function some<T>(value: T): Option<T> {
  return { some: true, value };
}

export function none(): Option<never> {
  return { some: false };
}

export function isOk<T, E>(result: Result<T, E>): result is { readonly ok: true; readonly value: T } {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is { readonly ok: false; readonly error: E } {
  return !result.ok;
}

export function mapResult<T, U, E>(result: Result<T, E>, fn: (val: T) => U): Result<U, E> {
  if (result.ok) return { ok: true, value: fn(result.value) };
  return result;
}

export function flatMapResult<T, U, E>(result: Result<T, E>, fn: (val: T) => Result<U, E>): Result<U, E> {
  if (result.ok) return fn(result.value);
  return result;
}

export function matchResult<T, E, R>(result: Result<T, E>, onOk: (v: T) => R, onErr: (e: E) => R): R {
  return result.ok ? onOk(result.value) : onErr(result.error);
}

export function now(): Timestamp {
  return Date.now() as Timestamp;
}

export function groupBy<T, K extends string | number>(
  items: readonly T[],
  keyFn: (item: T) => K,
): Readonly<Record<K, readonly T[]>> {
  const result = {} as Record<K, T[]>;
  for (const item of items) {
    const key = keyFn(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  }
  return result as Readonly<Record<K, readonly T[]>>;
}

export function indexBy<T, K extends string | number>(
  items: readonly T[],
  keyFn: (item: T) => K,
): ReadonlyMap<K, T> {
  const map = new Map<K, T>();
  for (const item of items) {
    map.set(keyFn(item), item);
  }
  return map;
}
`,

  // 2: Audit trails & change tracker
  `// mod_02.ts - Auditing, change tracking and state wrappers
import {
  type EntityId,
  type Result,
  type Timestamp,
  type DeepReadonly,
  now,
  ok,
  err,
} from "./mod_01.js";

export type AuditAction = "create" | "update" | "archive" | "purge";

export interface AuditMetadata<TEntity extends string> {
  readonly entityType: TEntity;
  readonly entityId: EntityId<TEntity>;
  readonly action: AuditAction;
  readonly actorId: string;
  readonly timestamp: Timestamp;
}

export interface AuditEntry<TEntity extends string, TData> {
  readonly metadata: AuditMetadata<TEntity>;
  readonly payload: TData;
}

export type EntityState<T> =
  | { readonly status: "active"; readonly data: T }
  | { readonly status: "suspended"; readonly reason: string; readonly since: Timestamp }
  | { readonly status: "archived"; readonly archivedAt: Timestamp };

export interface ChangeRecord<T> {
  readonly property: keyof T;
  readonly previous: unknown;
  readonly current: unknown;
}

export class ChangeTracker<T extends Record<string, unknown>> {
  private readonly history: AuditEntry<string, readonly ChangeRecord<T>[]>[] = [];

  constructor(
    private readonly entityType: string,
    private readonly entityId: EntityId<string>,
    private snapshot: T,
  ) {}

  public getSnapshot(): DeepReadonly<T> {
    return this.snapshot as DeepReadonly<T>;
  }

  public recordChange(
    actorId: string,
    updates: Partial<T>,
  ): Result<readonly ChangeRecord<T>[], string> {
    const changes: ChangeRecord<T>[] = [];
    const updated = { ...this.snapshot };
    for (const key of Object.keys(updates) as (keyof T)[]) {
      const prev = this.snapshot[key];
      const next = updates[key];
      if (prev !== next) {
        changes.push({ property: key, previous: prev, current: next });
        updated[key] = next as T[keyof T];
      }
    }
    if (changes.length === 0) {
      return err("NO_CHANGES_DETECTED");
    }
    this.snapshot = updated;
    this.history.push({
      metadata: {
        entityType: this.entityType,
        entityId: this.entityId,
        action: "update",
        actorId,
        timestamp: now(),
      },
      payload: Object.freeze(changes),
    });
    return ok(changes);
  }

  public getAuditLog(): readonly AuditEntry<string, readonly ChangeRecord<T>[]>[] {
    return [...this.history];
  }

  public filterByAction(action: AuditAction): readonly AuditEntry<string, readonly ChangeRecord<T>[]>[] {
    return this.history.filter((entry) => entry.metadata.action === action);
  }
}
`,

  // 3: Customer profiles & billing options
  `// mod_03.ts - Customer accounts and billing profiles
import {
  type EntityId,
  type PaginatedResult,
  type PaginationQuery,
  type Result,
  type Timestamp,
  now,
  ok,
  err,
} from "./mod_01.js";
import { type EntityState } from "./mod_02.js";

export type CustomerTier = "standard" | "preferred" | "enterprise";
export type CustomerType = "individual" | "fleet" | "government";

export type ContactChannel =
  | { readonly kind: "email"; readonly address: string }
  | { readonly kind: "phone"; readonly number: string }
  | { readonly kind: "postal"; readonly address: string };

export type BillingPreference =
  | { readonly method: "invoice"; readonly netDays: number; readonly creditLimitCents: number }
  | { readonly method: "card"; readonly token: string }
  | { readonly method: "deposit"; readonly balanceCents: number };

export interface CustomerProfile {
  readonly id: EntityId<"Customer">;
  readonly name: string;
  readonly customerType: CustomerType;
  readonly tier: CustomerTier;
  readonly contacts: readonly ContactChannel[];
  readonly billing: BillingPreference;
  readonly createdAt: Timestamp;
}

export type CustomerEntity = EntityState<CustomerProfile>;

export function validateCustomerProfile(profile: CustomerProfile): Result<CustomerProfile, string> {
  if (!profile.name || profile.name.trim().length === 0) {
    return err("NAME_REQUIRED");
  }
  if (profile.contacts.length === 0) {
    return err("CONTACT_REQUIRED");
  }
  if (profile.billing.method === "invoice" && profile.billing.creditLimitCents < 0) {
    return err("INVALID_CREDIT_LIMIT");
  }
  return ok(profile);
}

export class CustomerDirectory {
  private readonly records = new Map<string, CustomerEntity>();

  public register(profile: CustomerProfile): Result<CustomerProfile, string> {
    const validated = validateCustomerProfile(profile);
    if (!validated.ok) return validated;
    if (this.records.has(profile.id)) return err("CUSTOMER_EXISTS");
    this.records.set(profile.id, { status: "active", data: profile });
    return ok(profile);
  }

  public findById(id: EntityId<"Customer">): CustomerEntity | undefined {
    return this.records.get(id);
  }

  public listActive(query: PaginationQuery): PaginatedResult<CustomerProfile> {
    const active: CustomerProfile[] = [];
    for (const entry of this.records.values()) {
      if (entry.status === "active") active.push(entry.data);
    }
    const sliced = active.slice(query.offset, query.offset + query.limit);
    return {
      items: sliced,
      total: active.length,
      offset: query.offset,
      limit: query.limit,
    };
  }

  public getTierMultiplier(tier: CustomerTier): number {
    switch (tier) {
      case "standard":
        return 1.0;
      case "preferred":
        return 0.92;
      case "enterprise":
        return 0.85;
      default: {
        const _exhaustive: never = tier;
        return 1.0;
      }
    }
  }
}
`,

  // 4: Inventory catalog & stock ledger
  `// mod_04.ts - Inventory catalog and stock ledger
import {
  type EntityId,
  type Result,
  type Timestamp,
  now,
  ok,
  err,
} from "./mod_01.js";

export type PartCategory = "engine" | "transmission" | "brake" | "suspension" | "electrical" | "fluid";
export type StockStatus = "in_stock" | "low_stock" | "backorder" | "discontinued";

export interface PartCatalogItem {
  readonly partNumber: EntityId<"Part">;
  readonly description: string;
  readonly category: PartCategory;
  readonly unitCostCents: number;
  readonly retailPriceCents: number;
  readonly reorderThreshold: number;
}

export type StockMovement =
  | { readonly kind: "receipt"; readonly quantity: number; readonly costCents: number }
  | { readonly kind: "allocation"; readonly orderId: string; readonly quantity: number }
  | { readonly kind: "adjustment"; readonly delta: number; readonly reason: string };

export interface InventoryPosition {
  readonly partNumber: EntityId<"Part">;
  readonly onHand: number;
  readonly reserved: number;
  readonly status: StockStatus;
  readonly lastUpdated: Timestamp;
}

export class InventoryLedger {
  private readonly items = new Map<string, PartCatalogItem>();
  private readonly positions = new Map<string, InventoryPosition>();

  public registerPart(item: PartCatalogItem): Result<PartCatalogItem, string> {
    if (this.items.has(item.partNumber)) return err("PART_ALREADY_EXISTS");
    this.items.set(item.partNumber, item);
    this.positions.set(item.partNumber, {
      partNumber: item.partNumber,
      onHand: 0,
      reserved: 0,
      status: "backorder",
      lastUpdated: now(),
    });
    return ok(item);
  }

  public applyMovement(partNumber: EntityId<"Part">, movement: StockMovement): Result<InventoryPosition, string> {
    const pos = this.positions.get(partNumber);
    const item = this.items.get(partNumber);
    if (!pos || !item) return err("UNKNOWN_PART");

    let nextOnHand = pos.onHand;
    let nextReserved = pos.reserved;

    switch (movement.kind) {
      case "receipt":
        nextOnHand += movement.quantity;
        break;
      case "allocation":
        if (pos.onHand - pos.reserved < movement.quantity) return err("INSUFFICIENT_STOCK");
        nextReserved += movement.quantity;
        break;
      case "adjustment":
        nextOnHand += movement.delta;
        if (nextOnHand < 0) return err("NEGATIVE_STOCK_DISALLOWED");
        break;
      default: {
        const _exhaustive: never = movement;
        return err(\`UNKNOWN_MOVEMENT:\${_exhaustive}\`);
      }
    }

    const available = nextOnHand - nextReserved;
    let status: StockStatus = "in_stock";
    if (available <= 0) status = "backorder";
    else if (available <= item.reorderThreshold) status = "low_stock";

    const nextPos: InventoryPosition = {
      partNumber,
      onHand: nextOnHand,
      reserved: nextReserved,
      status,
      lastUpdated: now(),
    };
    this.positions.set(partNumber, nextPos);
    return ok(nextPos);
  }

  public getValuationCents(): number {
    let total = 0;
    for (const pos of this.positions.values()) {
      const item = this.items.get(pos.partNumber);
      if (item) total += pos.onHand * item.unitCostCents;
    }
    return total;
  }
}
`,

  // 5: Service appointments & scheduling
  `// mod_05.ts - Service appointments and scheduling
import {
  type EntityId,
  type Result,
  type Timestamp,
  now,
  ok,
  err,
} from "./mod_01.js";

export type AppointmentPhase =
  | "requested"
  | "confirmed"
  | "in_progress"
  | "ready_for_pickup"
  | "completed"
  | "cancelled";

export type ServiceKind =
  | "routine_maintenance"
  | "brake_service"
  | "engine_diagnostic"
  | "transmission_overhaul"
  | "safety_inspection";

export interface TimeSlot {
  readonly startTimestamp: Timestamp;
  readonly durationMinutes: number;
}

export interface AppointmentRecord {
  readonly id: EntityId<"Appointment">;
  readonly customerId: EntityId<"Customer">;
  readonly vehicleVin: string;
  readonly serviceKind: ServiceKind;
  readonly slot: TimeSlot;
  readonly phase: AppointmentPhase;
  readonly assignedMechanicId: string | null;
  readonly notes: string;
}

export class AppointmentStateMachine {
  public static canTransition(current: AppointmentPhase, next: AppointmentPhase): boolean {
    const validTransitions: Record<AppointmentPhase, readonly AppointmentPhase[]> = {
      requested: ["confirmed", "cancelled"],
      confirmed: ["in_progress", "cancelled"],
      in_progress: ["ready_for_pickup", "cancelled"],
      ready_for_pickup: ["completed"],
      completed: [],
      cancelled: [],
    };
    return validTransitions[current].includes(next);
  }

  public static transition(
    appointment: AppointmentRecord,
    nextPhase: AppointmentPhase,
  ): Result<AppointmentRecord, string> {
    if (!this.canTransition(appointment.phase, nextPhase)) {
      return err(\`INVALID_TRANSITION:\${appointment.phase}->\${nextPhase}\`);
    }
    return ok({ ...appointment, phase: nextPhase });
  }

  public static estimatedDurationMinutes(kind: ServiceKind): number {
    switch (kind) {
      case "routine_maintenance":
        return 60;
      case "brake_service":
        return 90;
      case "engine_diagnostic":
        return 120;
      case "transmission_overhaul":
        return 360;
      case "safety_inspection":
        return 45;
      default: {
        const _exhaustive: never = kind;
        return 60;
      }
    }
  }
}
`,

  // 6: Financial ledger & invoices (completes moderate tier)
  `// mod_06.ts - Financial ledger and invoice calculations
import {
  type EntityId,
  type Result,
  type Timestamp,
  now,
  ok,
  err,
} from "./mod_01.js";

export type PaymentStatus =
  | "draft"
  | "pending_approval"
  | "authorized"
  | "settled"
  | "declined"
  | "refunded";

export type InvoiceLine =
  | { readonly kind: "labor"; readonly description: string; readonly hours: number; readonly rateCents: number }
  | { readonly kind: "part"; readonly partNumber: EntityId<"Part">; readonly quantity: number; readonly unitPriceCents: number }
  | { readonly kind: "fee"; readonly label: string; readonly amountCents: number }
  | { readonly kind: "discount"; readonly label: string; readonly discountCents: number };

export interface InvoiceRecord {
  readonly id: EntityId<"Invoice">;
  readonly appointmentId: EntityId<"Appointment">;
  readonly customerId: EntityId<"Customer">;
  readonly lines: readonly InvoiceLine[];
  readonly subtotalCents: number;
  readonly taxCents: number;
  readonly totalCents: number;
  readonly status: PaymentStatus;
  readonly createdAt: Timestamp;
}

export function computeInvoiceTotals(
  lines: readonly InvoiceLine[],
  taxRatePercent: number,
): { subtotalCents: number; taxCents: number; totalCents: number } {
  let subtotal = 0;
  for (const line of lines) {
    switch (line.kind) {
      case "labor":
        subtotal += Math.round(line.hours * line.rateCents);
        break;
      case "part":
        subtotal += line.quantity * line.unitPriceCents;
        break;
      case "fee":
        subtotal += line.amountCents;
        break;
      case "discount":
        subtotal -= line.discountCents;
        break;
      default: {
        const _exhaustive: never = line;
        throw new Error(\`UNKNOWN_LINE:\${_exhaustive}\`);
      }
    }
  }
  const tax = Math.round(Math.max(0, subtotal) * (taxRatePercent / 100));
  return {
    subtotalCents: subtotal,
    taxCents: tax,
    totalCents: subtotal + tax,
  };
}

export class LedgerJournal {
  private readonly settledInvoices: InvoiceRecord[] = [];

  public settle(invoice: InvoiceRecord): Result<InvoiceRecord, string> {
    if (invoice.status === "settled") return err("ALREADY_SETTLED");
    const settled: InvoiceRecord = { ...invoice, status: "settled" };
    this.settledInvoices.push(settled);
    return ok(settled);
  }

  public totalSettledRevenueCents(): number {
    return this.settledInvoices.reduce((sum, inv) => sum + inv.totalCents, 0);
  }
}
`,

  // 7: Warranty claims
  `// mod_07.ts - Warranty and claim processing
import {
  type EntityId,
  type Result,
  type Timestamp,
  now,
  ok,
  err,
} from "./mod_01.js";
import { type InvoiceRecord } from "./mod_06.js";

export type ClaimVerdict = "approved" | "rejected" | "partial_approval" | "pending_docs";
export type WarrantyCoverage = "powertrain" | "bumper_to_bumper" | "emissions" | "electrical";

export interface WarrantyPolicy {
  readonly policyId: EntityId<"Warranty">;
  readonly coverage: WarrantyCoverage;
  readonly maxPayoutCents: number;
  readonly deductibleCents: number;
  readonly validUntil: Timestamp;
}

export interface WarrantyClaim {
  readonly claimId: EntityId<"Claim">;
  readonly policyId: EntityId<"Warranty">;
  readonly invoiceId: EntityId<"Invoice">;
  readonly requestedCents: number;
  readonly approvedCents: number;
  readonly verdict: ClaimVerdict;
  readonly filedAt: Timestamp;
}

export function evaluateClaim(
  claim: WarrantyClaim,
  policy: WarrantyPolicy,
): Result<WarrantyClaim, string> {
  if (policy.validUntil < claim.filedAt) {
    return ok({ ...claim, approvedCents: 0, verdict: "rejected" });
  }
  const eligible = Math.max(0, claim.requestedCents - policy.deductibleCents);
  const capped = Math.min(eligible, policy.maxPayoutCents);
  const verdict: ClaimVerdict = capped >= claim.requestedCents ? "approved" : "partial_approval";
  return ok({ ...claim, approvedCents: capped, verdict });
}

export function batchAdjudicate(
  claims: readonly WarrantyClaim[],
  policyMap: ReadonlyMap<string, WarrantyPolicy>,
): readonly WarrantyClaim[] {
  return claims.map((claim) => {
    const policy = policyMap.get(claim.policyId);
    if (!policy) return { ...claim, approvedCents: 0, verdict: "rejected" };
    const res = evaluateClaim(claim, policy);
    return res.ok ? res.value : claim;
  });
}
`,

  // 8: Telematics & diagnostic trouble codes
  `// mod_08.ts - Vehicle telematics and fault codes
import {
  type EntityId,
  type Result,
  type Timestamp,
  now,
  ok,
  err,
} from "./mod_01.js";

export type DtcSeverity = "advisory" | "minor" | "major" | "critical";

export interface DtcFaultCode {
  readonly code: string;
  readonly description: string;
  readonly severity: DtcSeverity;
  readonly subsystem: "engine" | "transmission" | "braking" | "exhaust" | "body";
}

export interface TelemetryReading {
  readonly vin: string;
  readonly timestamp: Timestamp;
  readonly odometerKm: number;
  readonly engineRpm: number;
  readonly coolantTempCelsius: number;
  readonly activeFaults: readonly DtcFaultCode[];
}

export class TelemetryIngester {
  private readonly history = new Map<string, TelemetryReading[]>();

  public ingest(reading: TelemetryReading): Result<void, string> {
    if (reading.odometerKm < 0) return err("INVALID_ODOMETER");
    const list = this.history.get(reading.vin) ?? [];
    list.push(reading);
    this.history.set(reading.vin, list);
    return ok(undefined);
  }

  public getCriticalFaults(vin: string): readonly DtcFaultCode[] {
    const list = this.history.get(vin);
    if (!list || list.length === 0) return [];
    const latest = list[list.length - 1];
    return latest.activeFaults.filter((f) => f.severity === "critical");
  }

  public getLatestReading(vin: string): TelemetryReading | undefined {
    const list = this.history.get(vin);
    return list && list.length > 0 ? list[list.length - 1] : undefined;
  }
}
`,

  // 9: Fleet maintenance strategies
  `// mod_09.ts - Fleet management and maintenance schedules
import {
  type EntityId,
  type Result,
  type Timestamp,
  now,
  ok,
  err,
} from "./mod_01.js";
import { type CustomerProfile } from "./mod_03.js";
import { type TelemetryReading } from "./mod_08.js";

export type FleetStatus = "active" | "in_service" | "standby" | "decommissioned";

export interface FleetVehicle {
  readonly vin: string;
  readonly fleetCustomerId: EntityId<"Customer">;
  readonly status: FleetStatus;
  readonly lastServiceOdometerKm: number;
  readonly serviceIntervalKm: number;
}

export function isServiceRequired(vehicle: FleetVehicle, currentOdometerKm: number): boolean {
  if (vehicle.status !== "active") return false;
  return currentOdometerKm - vehicle.lastServiceOdometerKm >= vehicle.serviceIntervalKm;
}

export function batchCheckFleet(
  vehicles: readonly FleetVehicle[],
  odometers: ReadonlyMap<string, number>,
): readonly FleetVehicle[] {
  return vehicles.filter((v) => {
    const km = odometers.get(v.vin);
    return km !== undefined && isServiceRequired(v, km);
  });
}

export function calculateFleetReadiness(vehicles: readonly FleetVehicle[]): number {
  if (vehicles.length === 0) return 1.0;
  const ready = vehicles.filter((v) => v.status === "active" || v.status === "standby").length;
  return ready / vehicles.length;
}
`,

  // 10: Technician skills & qualifications
  `// mod_10.ts - Technician certifications and skill matrices
import {
  type EntityId,
  type Result,
  ok,
  err,
} from "./mod_01.js";
import { type ServiceKind } from "./mod_05.js";

export type QualificationLevel = "apprentice" | "journeyman" | "master" | "specialist";

export interface TechnicianSkill {
  readonly serviceKind: ServiceKind;
  readonly level: QualificationLevel;
  readonly certifiedSince: number;
}

export interface TechnicianProfile {
  readonly technicianId: EntityId<"Technician">;
  readonly name: string;
  readonly skills: readonly TechnicianSkill[];
  readonly active: boolean;
}

export function isTechnicianQualified(
  technician: TechnicianProfile,
  requiredKind: ServiceKind,
  minLevel: QualificationLevel,
): boolean {
  if (!technician.active) return false;
  const levelRanks: Record<QualificationLevel, number> = {
    apprentice: 1,
    journeyman: 2,
    master: 3,
    specialist: 4,
  };
  const skill = technician.skills.find((s) => s.serviceKind === requiredKind);
  if (!skill) return false;
  return levelRanks[skill.level] >= levelRanks[minLevel];
}

export function findEligibleTechnicians(
  technicians: readonly TechnicianProfile[],
  requiredKind: ServiceKind,
  minLevel: QualificationLevel,
): readonly TechnicianProfile[] {
  return technicians.filter((t) => isTechnicianQualified(t, requiredKind, minLevel));
}
`,

  // 11: Work order task DAG
  `// mod_11.ts - Work order task execution graph
import {
  type EntityId,
  type Result,
  type Timestamp,
  now,
  ok,
  err,
} from "./mod_01.js";
import { type AppointmentRecord } from "./mod_05.js";
import { type TechnicianProfile } from "./mod_10.js";

export type TaskStatus = "pending" | "ready" | "in_progress" | "blocked" | "completed";

export interface WorkOrderTask {
  readonly taskId: EntityId<"Task">;
  readonly title: string;
  readonly dependencies: readonly EntityId<"Task">[];
  readonly status: TaskStatus;
  readonly assignedTechnicianId: EntityId<"Technician"> | null;
  readonly estimatedMinutes: number;
}

export class TaskDependencyGraph {
  private readonly tasks = new Map<string, WorkOrderTask>();

  public addTask(task: WorkOrderTask): void {
    this.tasks.set(task.taskId, task);
  }

  public getReadyTasks(): readonly WorkOrderTask[] {
    const ready: WorkOrderTask[] = [];
    for (const task of this.tasks.values()) {
      if (task.status !== "pending") continue;
      const depsSatisfied = task.dependencies.every((depId) => {
        const dep = this.tasks.get(depId);
        return dep && dep.status === "completed";
      });
      if (depsSatisfied) ready.push(task);
    }
    return ready;
  }

  public totalEstimatedMinutes(): number {
    let total = 0;
    for (const task of this.tasks.values()) {
      total += task.estimatedMinutes;
    }
    return total;
  }
}
`,

  // 12: Quality control inspection checklist
  `// mod_12.ts - Quality control and safety inspection checklists
import {
  type EntityId,
  type Result,
  type Timestamp,
  now,
  ok,
  err,
} from "./mod_01.js";

export type InspectionVerdict = "pass" | "fail" | "conditional_pass";

export interface ChecklistItem {
  readonly code: string;
  readonly requirement: string;
  readonly critical: boolean;
  readonly verified: boolean;
}

export interface QualityReport {
  readonly reportId: EntityId<"QcReport">;
  readonly appointmentId: EntityId<"Appointment">;
  readonly inspectorId: string;
  readonly items: readonly ChecklistItem[];
  readonly verdict: InspectionVerdict;
  readonly inspectedAt: Timestamp;
}

export function evaluateInspection(
  items: readonly ChecklistItem[],
  appointmentId: EntityId<"Appointment">,
  inspectorId: string,
): QualityReport {
  const allCriticalPassed = items.every((item) => !item.critical || item.verified);
  const totalVerified = items.filter((item) => item.verified).length;
  const passRatio = totalVerified / items.length;

  let verdict: InspectionVerdict = "pass";
  if (!allCriticalPassed) {
    verdict = "fail";
  } else if (passRatio < 0.9) {
    verdict = "conditional_pass";
  }

  return {
    reportId: \`qc_\${now()}\` as EntityId<"QcReport">,
    appointmentId,
    inspectorId,
    items,
    verdict,
    inspectedAt: now(),
  };
}
`,

  // 13: Procurement & purchase orders
  `// mod_13.ts - Supplier procurement and purchase orders
import {
  type EntityId,
  type Result,
  type Timestamp,
  now,
  ok,
  err,
} from "./mod_01.js";

export type PurchaseOrderStatus = "draft" | "submitted" | "confirmed" | "fulfilled" | "cancelled";

export interface PoLineItem {
  readonly partNumber: EntityId<"Part">;
  readonly quantity: number;
  readonly negotiatedCostCents: number;
}

export interface PurchaseOrder {
  readonly poId: EntityId<"PO">;
  readonly supplierId: string;
  readonly lines: readonly PoLineItem[];
  readonly status: PurchaseOrderStatus;
  readonly createdTimestamp: Timestamp;
}

export function calculatePoTotal(order: PurchaseOrder): number {
  return order.lines.reduce((sum, line) => sum + line.quantity * line.negotiatedCostCents, 0);
}

export function isOrderFulfilled(order: PurchaseOrder): boolean {
  return order.status === "fulfilled";
}
`,

  // 14: Warehouse bins and logistics
  `// mod_14.ts - Warehouse locations and bin management
import {
  type EntityId,
  type Result,
  ok,
  err,
} from "./mod_01.js";

export interface BinLocation {
  readonly aisle: string;
  readonly rack: number;
  readonly shelf: number;
  readonly bin: string;
}

export interface StoredPartInventory {
  readonly partNumber: EntityId<"Part">;
  readonly location: BinLocation;
  readonly capacity: number;
  readonly currentCount: number;
}

export function formatBinCode(loc: BinLocation): string {
  return \`\${loc.aisle}-\${loc.rack}\${loc.shelf}-\${loc.bin}\`;
}

export function hasFreeCapacity(item: StoredPartInventory): boolean {
  return item.currentCount < item.capacity;
}
`,

  // 15: Event notifications & communications
  `// mod_15.ts - Event notifications and customer communication
import {
  type EntityId,
  type Result,
  type Timestamp,
  now,
  ok,
  err,
} from "./mod_01.js";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface NotificationEnvelope {
  readonly notificationId: EntityId<"Notification">;
  readonly recipientCustomerId: EntityId<"Customer">;
  readonly channel: "email" | "sms" | "push";
  readonly priority: NotificationPriority;
  readonly subject: string;
  readonly bodyText: string;
  readonly createdAt: Timestamp;
}

export class NotificationQueue {
  private readonly queue: NotificationEnvelope[] = [];

  public enqueue(item: NotificationEnvelope): void {
    this.queue.push(item);
  }

  public drain(): readonly NotificationEnvelope[] {
    return this.queue.splice(0, this.queue.length);
  }

  public pendingCount(): number {
    return this.queue.length;
  }
}
`,

  // 16: Pricing rules & discount matrix
  `// mod_16.ts - Pricing policies and dynamic discounts
import {
  type EntityId,
  type Result,
  ok,
  err,
} from "./mod_01.js";
import { type CustomerTier } from "./mod_03.js";
import { type InvoiceLine } from "./mod_06.js";

export interface DiscountPolicy {
  readonly tier: CustomerTier;
  readonly partsDiscountPercent: number;
  readonly laborDiscountPercent: number;
}

export function applyDiscountPolicy(
  line: InvoiceLine,
  policy: DiscountPolicy,
): InvoiceLine {
  if (line.kind === "part" && policy.partsDiscountPercent > 0) {
    const discountedRate = Math.round(
      line.unitPriceCents * (1 - policy.partsDiscountPercent / 100),
    );
    return { ...line, unitPriceCents: discountedRate };
  }
  if (line.kind === "labor" && policy.laborDiscountPercent > 0) {
    const discountedRate = Math.round(
      line.rateCents * (1 - policy.laborDiscountPercent / 100),
    );
    return { ...line, rateCents: discountedRate };
  }
  return line;
}
`,

  // 17: Operational metrics & KPI aggregator
  `// mod_17.ts - Operational KPIs and analytics aggregation
import {
  type EntityId,
  type Result,
  type Timestamp,
  now,
  ok,
  err,
} from "./mod_01.js";
import { type AppointmentRecord } from "./mod_05.js";
import { type InvoiceRecord } from "./mod_06.js";
import { type WorkOrderTask } from "./mod_11.js";

export interface WorkshopMetricsSnapshot {
  readonly periodStart: Timestamp;
  readonly periodEnd: Timestamp;
  readonly totalCompletedAppointments: number;
  readonly totalRevenueCents: number;
  readonly averageRepairDurationMinutes: number;
}

export function calculateMetrics(
  appointments: readonly AppointmentRecord[],
  invoices: readonly InvoiceRecord[],
  tasks: readonly WorkOrderTask[],
  start: Timestamp,
  end: Timestamp,
): WorkshopMetricsSnapshot {
  const completed = appointments.filter((a) => a.phase === "completed").length;
  const revenue = invoices
    .filter((inv) => inv.status === "settled")
    .reduce((sum, inv) => sum + inv.totalCents, 0);
  const totalDuration = tasks
    .filter((t) => t.status === "completed")
    .reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const avgDuration = completed > 0 ? Math.round(totalDuration / completed) : 0;

  return {
    periodStart: start,
    periodEnd: end,
    totalCompletedAppointments: completed,
    totalRevenueCents: revenue,
    averageRepairDurationMinutes: avgDuration,
  };
}
`,

  // 18: Unified operations orchestrator
  `// mod_18.ts - Unified workshop operations orchestrator
import {
  type EntityId,
  type Result,
  type Timestamp,
  now,
  ok,
  err,
} from "./mod_01.js";
import { ChangeTracker } from "./mod_02.js";
import { CustomerDirectory, type CustomerProfile } from "./mod_03.js";
import { InventoryLedger, type PartCatalogItem } from "./mod_04.js";
import { AppointmentStateMachine, type AppointmentRecord } from "./mod_05.js";
import { computeInvoiceTotals, type InvoiceRecord, type InvoiceLine } from "./mod_06.js";
import { evaluateClaim, type WarrantyClaim, type WarrantyPolicy } from "./mod_07.js";
import { TelemetryIngester, type TelemetryReading } from "./mod_08.js";
import { batchCheckFleet, type FleetVehicle } from "./mod_09.js";
import { isTechnicianQualified, type TechnicianProfile } from "./mod_10.js";
import { TaskDependencyGraph, type WorkOrderTask } from "./mod_11.js";
import { evaluateInspection, type ChecklistItem, type QualityReport } from "./mod_12.js";
import { calculatePoTotal, type PurchaseOrder } from "./mod_13.js";
import { formatBinCode, type StoredPartInventory } from "./mod_14.js";
import { NotificationQueue, type NotificationEnvelope } from "./mod_15.js";
import { applyDiscountPolicy, type DiscountPolicy } from "./mod_16.js";
import { calculateMetrics, type WorkshopMetricsSnapshot } from "./mod_17.js";

export type WorkshopDomainEvent =
  | { readonly type: "appointment_scheduled"; readonly appointment: AppointmentRecord }
  | { readonly type: "invoice_settled"; readonly invoice: InvoiceRecord }
  | { readonly type: "quality_approved"; readonly report: QualityReport }
  | { readonly type: "inventory_depleted"; readonly partNumber: EntityId<"Part"> }
  | { readonly type: "warranty_filed"; readonly claim: WarrantyClaim };

export interface OperationsHubMetrics {
  readonly processedEventsCount: number;
  readonly scheduledAppointmentsCount: number;
  readonly settledInvoicesCount: number;
  readonly approvedReportsCount: number;
}

export class WorkshopOperationsHub {
  private readonly customers = new CustomerDirectory();
  private readonly inventory = new InventoryLedger();
  private readonly notifications = new NotificationQueue();
  private readonly tasks = new TaskDependencyGraph();
  private eventCount = 0;
  private appointmentCount = 0;
  private invoiceCount = 0;
  private reportCount = 0;

  public handleEvent(event: WorkshopDomainEvent): void {
    this.eventCount++;
    switch (event.type) {
      case "appointment_scheduled":
        this.appointmentCount++;
        break;
      case "invoice_settled":
        this.invoiceCount++;
        break;
      case "quality_approved":
        this.reportCount++;
        break;
      case "inventory_depleted":
        break;
      case "warranty_filed":
        break;
      default: {
        const _exhaustive: never = event;
        throw new Error(\`UNKNOWN_EVENT:\${_exhaustive}\`);
      }
    }
  }

  public getSummary(): OperationsHubMetrics {
    return {
      processedEventsCount: this.eventCount,
      scheduledAppointmentsCount: this.appointmentCount,
      settledInvoicesCount: this.invoiceCount,
      approvedReportsCount: this.reportCount,
    };
  }
}
`,

  // 19: Inspection defect history & wear analysis
  `// mod_19.ts - Inspection defect history & wear analysis
import {
  type EntityId,
  type Result,
  type Timestamp,
  now,
  ok,
  err,
} from "./mod_01.js";
import { type QualityReport, type ChecklistItem } from "./mod_12.js";
import { type TelemetryReading } from "./mod_08.js";

export interface RecurringDefectRecord {
  readonly vin: string;
  readonly componentCode: string;
  occurrences: number;
  readonly firstObserved: Timestamp;
  lastObserved: Timestamp;
}

export class DefectPatternTracker {
  private readonly history = new Map<string, RecurringDefectRecord[]>();

  public ingestInspection(report: QualityReport, vin: string): void {
    const list = this.history.get(vin) ?? [];
    for (const item of report.items) {
      if (!item.verified) {
        const existing = list.find((d) => d.componentCode === item.code);
        if (existing) {
          existing.occurrences++;
          existing.lastObserved = now();
        } else {
          list.push({
            vin,
            componentCode: item.code,
            occurrences: 1,
            firstObserved: now(),
            lastObserved: now(),
          });
        }
      }
    }
    this.history.set(vin, list);
  }

  public getDefects(vin: string): readonly RecurringDefectRecord[] {
    return this.history.get(vin) ?? [];
  }
}
`,

  // 20: Subcontractor outsourced repair management
  `// mod_20.ts - Subcontractor outsourced repair management
import {
  type EntityId,
  type Result,
  type Timestamp,
  now,
  ok,
  err,
} from "./mod_01.js";
import { type ServiceKind } from "./mod_05.js";
import { type PurchaseOrder } from "./mod_13.js";

export type SubcontractorStatus = "pending" | "dispatched" | "in_repair" | "returned" | "invoiced";

export interface SubcontractOrder {
  readonly orderId: EntityId<"Subcontract">;
  readonly partnerVendorId: string;
  readonly serviceKind: ServiceKind;
  readonly agreedCostCents: number;
  readonly status: SubcontractorStatus;
  readonly dispatchedAt: Timestamp;
}

export function canDispatchSubcontract(costCents: number, maxAllowedCents: number): boolean {
  return costCents > 0 && costCents <= maxAllowedCents;
}
`,

  // 21: Manufacturer warranty recovery & reconciliation
  `// mod_21.ts - Manufacturer warranty recovery & reconciliation
import {
  type EntityId,
  type Result,
  type Timestamp,
  now,
  ok,
  err,
} from "./mod_01.js";
import { type WarrantyClaim } from "./mod_07.js";
import { type InvoiceRecord } from "./mod_06.js";

export interface RecoveryBatch {
  readonly batchId: EntityId<"RecoveryBatch">;
  readonly manufacturerId: string;
  readonly claims: readonly WarrantyClaim[];
  readonly totalRequestedCents: number;
  readonly totalSettledCents: number;
  readonly closed: boolean;
}

export function buildRecoveryBatch(
  batchId: EntityId<"RecoveryBatch">,
  manufacturerId: string,
  claims: readonly WarrantyClaim[],
): RecoveryBatch {
  const total = claims.reduce((acc, c) => acc + c.approvedCents, 0);
  return {
    batchId,
    manufacturerId,
    claims,
    totalRequestedCents: total,
    totalSettledCents: 0,
    closed: false,
  };
}
`,

  // 22: Workshop bay & lift scheduling
  `// mod_22.ts - Workshop bay & lift scheduling
import {
  type EntityId,
  type Result,
  type Timestamp,
  now,
  ok,
  err,
} from "./mod_01.js";
import { type TimeSlot, type ServiceKind } from "./mod_05.js";
import { type WorkOrderTask } from "./mod_11.js";

export type BayCapability = "heavy_lift" | "alignment_rack" | "paint_booth" | "quick_lube" | "standard_stall";

export interface ServiceBay {
  readonly bayId: EntityId<"Bay">;
  readonly capability: BayCapability;
  readonly maxVehicleWeightKg: number;
  readonly isOccupied: boolean;
}

export function isBaySuitable(bay: ServiceBay, serviceKind: ServiceKind, weightKg: number): boolean {
  if (weightKg > bay.maxVehicleWeightKg) return false;
  if (serviceKind === "engine_diagnostic") return true;
  if (serviceKind === "routine_maintenance" && (bay.capability === "quick_lube" || bay.capability === "standard_stall")) return true;
  return bay.capability === "heavy_lift" || bay.capability === "standard_stall";
}

export class BayScheduler {
  private readonly bays = new Map<string, ServiceBay>();

  public registerBay(bay: ServiceBay): void {
    this.bays.set(bay.bayId, bay);
  }

  public findAvailableBay(serviceKind: ServiceKind, weightKg: number): ServiceBay | undefined {
    for (const bay of this.bays.values()) {
      if (!bay.isOccupied && isBaySuitable(bay, serviceKind, weightKg)) {
        return bay;
      }
    }
    return undefined;
  }
}
`,

  // 23: Customer satisfaction surveys & NPS
  `// mod_23.ts - Customer satisfaction surveys & NPS
import {
  type EntityId,
  type Result,
  type Timestamp,
  now,
  ok,
  err,
} from "./mod_01.js";
import { type CustomerProfile } from "./mod_03.js";
import { type NotificationEnvelope } from "./mod_15.js";
import { type WorkshopMetricsSnapshot } from "./mod_17.js";

export interface SurveyResponse {
  readonly surveyId: EntityId<"Survey">;
  readonly customerId: EntityId<"Customer">;
  readonly appointmentId: EntityId<"Appointment">;
  readonly score: number;
  readonly feedbackText: string;
  readonly receivedAt: Timestamp;
}

export function calculateNpsScore(responses: readonly SurveyResponse[]): number {
  if (responses.length === 0) return 0;
  let promoters = 0;
  let detractors = 0;
  for (const r of responses) {
    if (r.score >= 9) promoters++;
    else if (r.score <= 6) detractors++;
  }
  return Math.round(((promoters - detractors) / responses.length) * 100);
}

export class SurveyCollector {
  private readonly responses: SurveyResponse[] = [];

  public recordResponse(response: SurveyResponse): Result<void, string> {
    if (response.score < 0 || response.score > 10) return err("INVALID_SCORE_RANGE");
    this.responses.push(response);
    return ok(undefined);
  }

  public getScore(): number {
    return calculateNpsScore(this.responses);
  }
}
`,

  // 24: Master compliance and regulatory reporting hub
  `// mod_24.ts - Master compliance and regulatory reporting hub
import {
  type EntityId,
  type Result,
  type Timestamp,
  now,
  ok,
  err,
} from "./mod_01.js";
import { type ChangeRecord } from "./mod_02.js";
import { type CustomerProfile } from "./mod_03.js";
import { type InvoiceRecord } from "./mod_06.js";
import { type QualityReport } from "./mod_12.js";
import { WorkshopOperationsHub } from "./mod_18.js";
import { type RecoveryBatch } from "./mod_21.js";
import { type SurveyResponse } from "./mod_23.js";

export interface ComplianceAuditPack {
  readonly exportTimestamp: Timestamp;
  readonly jurisdiction: string;
  readonly verifiedInspectionsCount: number;
  readonly totalInvoicedCents: number;
  readonly complianceSignoff: boolean;
  readonly auditHash: string;
}

export function generateAuditPack(
  reports: readonly QualityReport[],
  invoices: readonly InvoiceRecord[],
  jurisdiction: string,
): ComplianceAuditPack {
  const verifiedCount = reports.filter((r) => r.verdict === "pass").length;
  const invoiced = invoices.reduce((sum, inv) => sum + inv.totalCents, 0);

  return {
    exportTimestamp: now(),
    jurisdiction,
    verifiedInspectionsCount: verifiedCount,
    totalInvoicedCents: invoiced,
    complianceSignoff: verifiedCount >= 0,
    auditHash: \`aud_\${jurisdiction}_\${verifiedCount}_\${invoiced}\`,
  };
}

export class MasterComplianceExporter {
  private readonly generatedPacks: ComplianceAuditPack[] = [];

  public archive(pack: ComplianceAuditPack): void {
    this.generatedPacks.push(pack);
  }

  public getArchive(): readonly ComplianceAuditPack[] {
    return [...this.generatedPacks];
  }

  public verifyIntegrity(pack: ComplianceAuditPack): boolean {
    const expected = \`aud_\${pack.jurisdiction}_\${pack.verifiedInspectionsCount}_\${pack.totalInvoicedCents}\`;
    return pack.auditHash === expected;
  }

  public exportJsonSummary(pack: ComplianceAuditPack): string {
    return JSON.stringify({
      schema: "mmp174-audit-v1",
      jurisdiction: pack.jurisdiction,
      timestamp: pack.exportTimestamp,
      inspections: pack.verifiedInspectionsCount,
      revenueCents: pack.totalInvoicedCents,
      valid: pack.complianceSignoff,
      checksum: pack.auditHash,
    });
  }
}
`,
];

export function generateSyntheticModules(count) {
  if (count < 0 || count > SYNTHETIC_MODULE_TEMPLATES.length) {
    throw new Error(`INVALID_MODULE_COUNT: requested ${count}, max ${SYNTHETIC_MODULE_TEMPLATES.length}`);
  }

  const modules = [];
  for (let i = 0; i < count; i++) {
    const padIndex = String(i + 1).padStart(2, "0");
    const path = `src/synthetic/mod_${padIndex}.ts`;
    const content = SYNTHETIC_MODULE_TEMPLATES[i];
    modules.push({
      path,
      sha256: sha256(content),
      content,
    });
  }
  return modules;
}

export function buildTierBundle(tierName, workshopRoot) {
  const config = TIER_CONFIGS[tierName];
  if (!config) {
    throw new Error(`UNKNOWN_TIER: ${tierName}`);
  }

  const baselineFiles = loadBaselineFiles(workshopRoot);
  const syntheticFiles = generateSyntheticModules(config.moduleCount);
  const allFiles = [...baselineFiles, ...syntheticFiles];

  // Admitted through canonical validateBundle
  const validated = validateBundle(allFiles);

  return {
    tier: tierName,
    moduleCount: config.moduleCount,
    fileCount: validated.files.length,
    candidateSha: validated.candidateSha,
    totalBytes: validated.files.reduce((sum, f) => sum + Buffer.byteLength(f.content), 0),
    files: validated.files,
  };
}
