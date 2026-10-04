import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { API_BASE_URL } from '../../core/api/api.config';
import { CrrMonitorResponse } from './crr-monitor.model';

/** CRR maintained vs. requirement for a month, split into fortnights (`GET /crr?month=yyyy-MM`). */
@Injectable({ providedIn: 'root' })
export class CrrMonitorService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly dataSignal = signal<CrrMonitorResponse | null>(null);

  readonly data = this.dataSignal.asReadonly();

  load(month: string | null): void {
    const params = month ? new HttpParams().set('month', month) : new HttpParams();
    this.http.get<CrrMonitorResponse>(`${this.api}/crr`, { params }).subscribe((res) => this.dataSignal.set(res));
  }
}
