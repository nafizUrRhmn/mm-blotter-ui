import { DealTypeKey } from './deal.model';

export interface DealTypeOption {
  key: DealTypeKey;
  label: string;
}

export interface DealTypeGroup {
  id: string;
  title: string;
  options: DealTypeOption[];
}

export interface CardOption {
  id: string;
  label: string;
}
