export interface CounterpartyBreakdown {
  name: string;
  amount: number;
  forecast?: boolean;
}

export interface InstrumentRow {
  key: string;
  label: string;
  /** Generic 3-column values — meaning depends on the card's columnLabels. */
  col1: number;
  col2: number;
  net: number;
  counterparties?: CounterpartyBreakdown[];
}

export type InstrumentCardAccent = 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'secondary';

export interface InstrumentCardConfig {
  id: string;
  title: string;
  columnLabels: [string, string, string];
  rows: InstrumentRow[];
  totalLabel: string;
  /** Optional icon (from the shared Icon set) shown in a colored header badge. */
  icon?: string;
  /** Bootstrap contextual color driving the icon badge + left accent border. */
  accent?: InstrumentCardAccent;
}
