import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { API_BASE_URL } from '../../core/api/api.config';
import { UiStateService } from '../../core/services/ui-state.service';
import { BarGroup, DonutSlice, KpiTile, TrendPoint } from './dashboard.model';

interface DashboardResponse {
  kpis: KpiTile[];
  closingTrend: TrendPoint[];
  borrowingVsPlacement: BarGroup[];
  dealMix: DonutSlice[];
}

/** Metrics derived from the position chain for the selected date (`GET /dashboard`); chart components only read these signals. */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly ui = inject(UiStateService);

  readonly kpis = signal<KpiTile[]>([]);
  readonly closingTrend = signal<TrendPoint[]>([]);
  readonly borrowingVsPlacement = signal<BarGroup[]>([]);
  readonly dealMix = signal<DonutSlice[]>([]);

  load(): void {
    this.http.get<DashboardResponse>(`${this.api}/dashboard`, { params: this.ui.dateParams() }).subscribe((d) => {
      this.kpis.set(d.kpis ?? []);
      this.closingTrend.set(d.closingTrend ?? []);
      this.borrowingVsPlacement.set(d.borrowingVsPlacement ?? []);
      this.dealMix.set(d.dealMix ?? []);
    });
  }
}
