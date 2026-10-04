export type ForecastCategory = 'Borrowing' | 'Placement' | 'FX' | 'G-sec' | 'RTGS';
export type ForecastDirection = 'Inflow' | 'Outflow';
export type SettlementMethod = 'RTGS' | 'BB Chq' | 'Other';

/** One button of the Add Forecast drawer (BRS §1.11), from `GET /forecasts/types`. */
export interface ForecastType {
  key: string;
  label: string;
  groupTitle: string;
  category: ForecastCategory;
  direction: ForecastDirection;
  /** Deal type the forecast adds to as a "New (Forecast)" deal; null = customer RTGS. */
  dealTypeKey: string | null;
}

export interface ForecastEntry {
  id: string;
  businessDate: string;
  forecastTypeKey: string;
  type: string;
  category: ForecastCategory;
  direction: ForecastDirection;
  counterparty: string;
  /** Signed: + inflow, − outflow. */
  volume: number;
  expectedTime: string;
  settlementMethod: SettlementMethod;
  userId: string;
  addedBy: string;
  /** Matched actual flow (FT deals / Jasper customer RTGS of the same type and counterparty). */
  actualAmount: number | null;
  /** Actual − Forecast. */
  gap: number | null;
  /**
   * Forecasts are retired by exclusion once the actual flow lands; a cut-off auto-excludes
   * anything still active. Deleting (drawer) is a soft delete kept for audit.
   */
  excluded: boolean;
  editable: boolean;
}

export interface ForecastInput {
  forecastTypeKey: string;
  counterparty: string;
  /** Unsigned; the sign comes from the type's direction. */
  volume: number;
  expectedTime: string;
  businessDate: string | null;
  settlementMethod: SettlementMethod;
}
