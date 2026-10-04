import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../../core/api/api.config';
import { UiStateService } from '../../core/services/ui-state.service';
import { DealGroup, SettlementStatus } from './deal.model';

/** Deals of the selected blotter date grouped into the page cards (`GET /deals?date=`). */
@Injectable({ providedIn: 'root' })
export class DealDetailsService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly ui = inject(UiStateService);
  private readonly groups = signal<DealGroup[]>([]);

  readonly data = this.groups.asReadonly();

  load(): void {
    this.http
      .get<DealGroup[]>(`${this.api}/deals`, { params: this.ui.dateParams() })
      .subscribe((groups) => this.groups.set(groups));
  }

  /** Manual settlement status (non-RTGS deals, e.g. G-Sec). */
  updateStatus(id: string, status: SettlementStatus): Observable<void> {
    return this.http
      .patch<void>(`${this.api}/deals/${id}/status`, { date: this.ui.date(), status })
      .pipe(tap(() => this.load()));
  }
}
