import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../../core/api/api.config';
import { UiStateService } from '../../core/services/ui-state.service';
import { OverviewSnapshot, ReconciliationEntry, RocEntry, RocEntryType } from './overview.model';

/** Overview for the selected blotter date (`GET /overview?date=`), plus its manual inputs. */
@Injectable({ providedIn: 'root' })
export class OverviewService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly ui = inject(UiStateService);
  private readonly snapshot = signal<OverviewSnapshot | null>(null);

  readonly data = this.snapshot.asReadonly();

  load(): void {
    this.http
      .get<OverviewSnapshot>(`${this.api}/overview`, { params: this.ui.dateParams() })
      .subscribe((s) => this.snapshot.set(s));
  }

  /** Target closing (F63): positive only; null clears it. Current day only. */
  setTargetClosing(value: number | null): Observable<OverviewSnapshot> {
    return this.http
      .put<OverviewSnapshot>(`${this.api}/overview/target`, { target: value })
      .pipe(tap((s) => this.snapshot.set(s)));
  }

  addRocEntry(branchKey: string, entryType: RocEntryType, amount: number, remarks: string | null, date: string): Observable<RocEntry> {
    return this.http
      .post<RocEntry>(`${this.api}/roc-entries`, { branchKey, entryType, amount, remarks, date })
      .pipe(tap(() => this.load()));
  }

  deleteRocEntry(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/roc-entries/${id}`).pipe(tap(() => this.load()));
  }

  addReconciliation(date: string, direction: 'IN' | 'OUT', amount: number, remarks: string): Observable<ReconciliationEntry> {
    return this.http
      .post<ReconciliationEntry>(`${this.api}/reconciliations`, { date, direction, amount, remarks })
      .pipe(tap(() => this.load()));
  }

  deleteReconciliation(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/reconciliations/${id}`).pipe(tap(() => this.load()));
  }
}
