/** Mirrors `OverviewResponse` (BRS §1.4, cards 1–3, 10, 11). Amounts are BDT crore, + inflow / − outflow. */

export interface DhakaPosition {
  previousClosing: number;
  previousReconciliation: number;
  /** F56 = previous closing + previous-day reconciliation net. */
  opening: number;
  /** F06 + F13 + F17 + F26 + F37 + F43. */
  flowTotal: number;
  /** F57. */
  closing: number;
  changePct: number;
}

export interface GlobalPosition {
  globalClosing: number;
  dhakaClosing: number;
  rocTotal: number;
  aboveFortnightRequirement: number | null;
  aboveDailyRequirement: number | null;
  target: number | null;
  aboveTarget: number;
}

export interface CrrRequirement {
  tdtlMonth: string | null;
  tdtl: number | null;
  dailyRatePct: number;
  fortnightRatePct: number;
  slrRatePct: number;
  crrDailyRequirement: number | null;
  crrFortnightRequirement: number | null;
  slrRequirement: number | null;
  slrMaintained: number | null;
}

export type RocEntryType = 'DEPOSIT' | 'WITHDRAWAL' | 'TT_IN' | 'TT_OUT' | 'RECONCILIATION';

export interface RocEntry {
  id: string;
  branchKey: string;
  entryType: RocEntryType;
  amount: number;
  remarks?: string;
  enteredBy: string;
  createdAt: string;
}

export interface RocRegion {
  key: string;
  label: string;
  opening: number;
  deposit: number;
  withdrawal: number;
  ttIn: number;
  ttOut: number;
  reconciliation: number;
  closing: number;
  entries: RocEntry[];
}

export interface ReconciliationEntry {
  id: string;
  amount: number;
  remarks: string;
  enteredBy: string;
  createdAt: string;
}

export interface OverviewSnapshot {
  businessDate: string;
  /** Current-day inputs (flows, ROC movements, target) are editable. */
  currentDay: boolean;
  /** Previous business day (T-1): reconciliation is editable. */
  reconciliationAllowed: boolean;
  dhaka: DhakaPosition;
  global: GlobalPosition;
  crr: CrrRequirement;
  roc: { total: number; regions: RocRegion[] };
  reconciliation: { inflow: number; outflow: number; net: number; entries: ReconciliationEntry[] };
}
