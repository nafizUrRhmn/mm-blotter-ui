import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL, SKIP_ERROR_TOAST } from '../../core/api/api.config';
import { UiStateService } from '../../core/services/ui-state.service';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'DECLINED';

/** BDT inflow / outflow approval request from "At your service" (BRS §1.9). */
export interface ApprovalRequest {
  id: string;
  externalRef: string;
  source: string;
  businessDate: string;
  direction: 'IN' | 'OUT';
  channel: string;
  counterparty: string;
  amount: number;
  description?: string;
  requestedBy?: string;
  requestedAt: string;
  status: ApprovalStatus;
  decidedBy?: string;
  decidedAt?: string;
  remarks?: string;
}

@Injectable({ providedIn: 'root' })
export class ApprovalService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly ui = inject(UiStateService);

  readonly requests = signal<ApprovalRequest[]>([]);
  readonly pending = signal<ApprovalRequest[]>([]);

  loadForDate(): void {
    this.http
      .get<ApprovalRequest[]>(`${this.api}/approvals`, { params: this.ui.dateParams() })
      .subscribe((list) => this.requests.set(list));
  }

  /** Background refresh for the notification drawer — no error toasts. */
  loadPending(): void {
    this.http
      .get<ApprovalRequest[]>(`${this.api}/approvals/pending`, { context: new HttpContext().set(SKIP_ERROR_TOAST, true) })
      .subscribe({ next: (list) => this.pending.set(list), error: () => undefined });
  }

  decide(id: string, approve: boolean, remarks: string | null = null): Observable<ApprovalRequest> {
    return this.http
      .post<ApprovalRequest>(`${this.api}/approvals/${id}/${approve ? 'approve' : 'decline'}`, { remarks })
      .pipe(
        tap((updated) => {
          this.requests.update((list) => list.map((a) => (a.id === id ? updated : a)));
          this.pending.update((list) => list.filter((a) => a.id !== id));
        }),
      );
  }
}
