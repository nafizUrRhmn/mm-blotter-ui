export interface TrendPoint {
  label: string;
  value: number;
}

export interface BarGroup {
  label: string;
  values: number[];
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export interface KpiTile {
  label: string;
  value: string;
  delta: string;
  tone: 'positive' | 'negative' | 'neutral';
}
