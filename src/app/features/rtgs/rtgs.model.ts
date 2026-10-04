export type DealType = 'Call' | 'SND' | 'Term' | 'Swap' | 'FX Outright';
export type DealStatus = 'Settled' | 'Processing' | 'Pending';

export interface RtgsDeal {
  dealNo: string;
  counterparty: string;
  type: DealType;
  volume: number;
  status: DealStatus;
  forecast?: boolean;
}

export interface RtgsSubCard {
  id: string;
  title: string;
  total: number;
  deals: RtgsDeal[];
}

export interface RtgsFlowCard {
  id: string;
  title: string;
  total: number;
  subCards: RtgsSubCard[];
}

export type CustomerFlowGroup = 'Live' | 'Approval Given' | 'Approval Pending' | 'Forecast';

export interface CustomerFlowRow {
  customer: string;
  group: CustomerFlowGroup;
  amount: number;
  forecast?: boolean;
}

export interface NetByType {
  type: DealType;
  amount: number;
}

export interface StatusCount {
  status: DealStatus;
  count: number;
}
