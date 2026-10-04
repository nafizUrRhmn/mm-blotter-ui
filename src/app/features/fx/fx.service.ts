import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { API_BASE_URL } from '../../core/api/api.config';
import { UiStateService } from '../../core/services/ui-state.service';

// ---- models (mirror the API DTOs; amounts in currency units unless noted) ----------------

export interface FxRateCard {
  currency: string;
  pair: string;
  bid: number;
  ask: number;
  high: number;
  low: number;
  changePct: number;
}

export interface CurrencyPosition {
  currency: string;
  symbol: string;
  amount: number;
}

export interface NostroLine {
  account: string;
  currency: string;
  balance: number;
}

export interface BankingUnitView {
  unit: 'DBU' | 'OBU';
  positions: CurrencyPosition[];
  nostros: NostroLine[];
}

export interface FxBlotter {
  businessDate: string;
  asOf?: string;
  rates: FxRateCard[];
  units: BankingUnitView[];
}

/** USD equivalent; spot / forward split the buy volume. */
export interface FxMaturityDay {
  date: string;
  label: string;
  buy: number;
  sell: number;
  net: number;
  spot: number;
  forward: number;
  contracts: number;
}

export interface FxMaturity {
  businessDate: string;
  asOf?: string;
  from: string;
  to: string;
  days: FxMaturityDay[];
  totalBuy: number;
  totalSell: number;
  netPosition: number;
}

export interface FcPlacementRow {
  dealNo: string;
  bank: string;
  currency: string;
  symbol: string;
  amount: number;
  rate: number;
  valueDate: string;
  maturityDate: string;
  days: number;
  interest: number;
}

export interface FcPlacements {
  businessDate: string;
  asOf?: string;
  totals: { currency: string; symbol: string; amount: number }[];
  weightedAvgRate?: number;
  placements: FcPlacementRow[];
}

/** Crore BDT, signed. */
export interface MaturityBucketRow {
  date: string;
  label: string;
  closingBalance: number;
  byType: Record<string, number>;
  totalMaturity: number;
  netPosition: number;
}

export interface MaturityBucket {
  businessDate: string;
  startingBalance: number;
  totalMaturityImpact: number;
  finalNetPosition: number;
  columns: { id: string; label: string }[];
  rows: MaturityBucketRow[];
  summary: { type: string; amount: number }[];
}

/** 105000000 → "105M", 10200000 → "10.20M", 890000 → "890,000" (FX desk conventions). */
export function fxAmount(value: number | null | undefined, signed = false): string {
  if (value === null || value === undefined) return '—';
  const sign = value < 0 ? '-' : signed && value > 0 ? '+' : '';
  const abs = Math.abs(value);
  const text =
    abs >= 1_000_000
      ? `${(abs / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`
      : abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return sign + text;
}

/** Millions with one decimal: 5200000 → "5.2". */
export function millions(value: number | null | undefined, signed = false, digits = 1): string {
  if (value === null || value === undefined) return '—';
  const m = value / 1_000_000;
  const text = Math.abs(m).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return (m < 0 ? '-' : signed && m > 0 ? '+' : '') + text;
}

/**
 * FX desk and maturity pages (`/fx/blotter`, `/fx/maturity`, `/fx/fc-placements`,
 * `/maturity-bucket`), each for the selected blotter date.
 */
@Injectable({ providedIn: 'root' })
export class FxService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly ui = inject(UiStateService);

  readonly blotter = signal<FxBlotter | null>(null);
  readonly maturity = signal<FxMaturity | null>(null);
  readonly placements = signal<FcPlacements | null>(null);
  readonly maturityBucket = signal<MaturityBucket | null>(null);

  loadBlotter(): void {
    this.get<FxBlotter>('/fx/blotter').subscribe((d) => this.blotter.set(d));
  }

  loadMaturity(): void {
    this.get<FxMaturity>('/fx/maturity').subscribe((d) => this.maturity.set(d));
  }

  loadPlacements(): void {
    this.get<FcPlacements>('/fx/fc-placements').subscribe((d) => this.placements.set(d));
  }

  loadMaturityBucket(): void {
    this.get<MaturityBucket>('/maturity-bucket').subscribe((d) => this.maturityBucket.set(d));
  }

  private get<T>(path: string) {
    return this.http.get<T>(`${this.api}${path}`, { params: this.ui.dateParams() });
  }
}
