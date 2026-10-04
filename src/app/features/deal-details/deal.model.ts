
export type DealTypeKey =
  | 'call-borrow'
  | 'term-borrow'
  | 'snd-borrow'
  | 'sb-swap'
  | 'repo'
  | 'call-placement'
  | 'term-placement'
  | 'snd-placement'
  | 'bs-swap'
  | 'reverse-repo'
  | 'fx-buy'
  | 'fx-sell'
  | 'gsec-buy'
  | 'gsec-sell'
  | 'gsec-maturity'
  | 'auction-outflow';

export type SettlementStatus = 'Settled' | 'Processing' | 'Pending';

export interface Deal {
  id: string;
  /** FT deal no; null for forecast deals. */
  dealNo: string | null;
  type: string;
  dealTypeKey: DealTypeKey;
  typeTone: 'buy' | 'sell';
  counterparty: string;
  volume: number;
  /** Forecast deals have no rate / tenor (BRS F73–F74). */
  rate: number | null;
  tenor: string | null;
  paymentStatus: string;
  /** RTGS deals: matched with Iflash; others (G-Sec, BB Chq): maintained by hand. */
  settlementStatus: SettlementStatus | null;
  forecast: boolean;
  statusEditable: boolean;
}

export interface DealGroup {
  id: string;
  title: string;
  deals: Deal[];
}
