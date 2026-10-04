import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { API_BASE_URL } from '../api/api.config';

/** yyyy-MM-dd → "28 Sep 2026". */
export function formatBusinessDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

@Injectable({ providedIn: 'root' })
export class UiStateService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  readonly sidebarCollapsed = signal(false);
  readonly mobileSidebarOpen = signal(false);

  /** The server's current business date (may be pinned for UAT), yyyy-MM-dd. */
  readonly businessDate = signal<string | null>(null);

  /**
   * Global business-date selector (BRS §1.1): the blotter date every page shows. Defaults to the
   * current business date; picking an earlier date shows that day's historic blotter.
   */
  readonly viewDate = signal<string | null>(null);

  /** Effective date: the picked one, else the current business date. */
  readonly date = computed(() => this.viewDate() ?? this.businessDate());
  readonly isToday = computed(() => !this.viewDate() || this.viewDate() === this.businessDate());
  readonly selectedDate = computed(() => formatBusinessDate(this.date()));

  /** Bumped by the topbar "Refresh" button; data pages reload whenever it changes. */
  readonly refreshTick = signal(0);

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update((v) => !v);
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  refresh(): void {
    this.refreshTick.update((n) => n + 1);
  }

  setViewDate(iso: string | null): void {
    this.viewDate.set(!iso || iso === this.businessDate() ? null : iso);
  }

  /** `?date=` for data calls when a historic date is selected. */
  dateParams(): HttpParams {
    const d = this.viewDate();
    return d ? new HttpParams().set('date', d) : new HttpParams();
  }

  loadBusinessDate(): void {
    this.http.get<{ businessDate: string }>(`${this.api}/business-date`).subscribe({
      next: ({ businessDate }) => this.businessDate.set(businessDate),
      error: () => undefined,
    });
  }
}
