/** Mirrors `CrrMonitorResponse` (BRS §1.7). Amounts are BDT crore. */

export interface CrrRates {
  /** x — daily minimum, percent of TDTL. */
  daily: number;
  dailyPlusHalf: number;
  /** y — fortnightly average, percent of TDTL. */
  fortnight: number;
}

export interface CrrSummary {
  thisMonthTdtl: number | null;
  thisMonthDailyRequirement: number | null;
  thisMonthFortnightRequirement: number | null;
  nextMonthTdtl: number | null;
  nextMonthDailyRequirement: number | null;
  nextMonthFortnightRequirement: number | null;
}

export interface BranchColumn {
  key: string;
  label: string;
}

export interface CrrDayRow {
  date: string;
  label: string;
  /** Weekend / holiday: previous balance carried forward. */
  carriedForward: boolean;
  branches: Record<string, number>;
  dhaka: number;
  rocTotal: number;
  global: number;
  maintainedPct: number | null;
  excessDaily: number | null;
  excessDailyPlusHalf: number | null;
  excessFortnight: number | null;
  cumulativeExcess: number | null;
}

export interface CrrFortnight {
  label: string;
  from: string;
  to: string;
  rows: CrrDayRow[];
  averageGlobal: number | null;
  requirement: number | null;
  averageExcess: number | null;
}

export interface CrrMonitorResponse {
  month: string;
  previousMonth: string;
  nextMonth: string;
  rates: CrrRates;
  summary: CrrSummary;
  branches: BranchColumn[];
  fortnights: CrrFortnight[];
}
