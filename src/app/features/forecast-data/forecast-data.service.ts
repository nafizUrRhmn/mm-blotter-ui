import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL, SKIP_ERROR_TOAST } from '../../core/api/api.config';
import { UiStateService } from '../../core/services/ui-state.service';
import { ForecastEntry, ForecastInput, ForecastType } from './forecast.model';

/**
 * Dealer-entered forecasts (BRS §1.10, §1.11) backed by `/forecasts`. Attribution (who added it)
 * is taken from the authenticated user server-side, never sent by the client.
 */
@Injectable({ providedIn: 'root' })
export class ForecastDataService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly ui = inject(UiStateService);
  private readonly entriesSignal = signal<ForecastEntry[]>([]);
  private readonly typesSignal = signal<ForecastType[]>([]);

  readonly entries = this.entriesSignal.asReadonly();
  readonly types = this.typesSignal.asReadonly();
  readonly drawerOpen = signal(false);
  /** Entry being edited in the drawer, if any. */
  readonly editing = signal<ForecastEntry | null>(null);

  /** Drawer buttons grouped as in the BRS: Borrowings, Placements, FX, G-Sec, RTGS. */
  readonly typeGroups = computed(() => {
    const groups = new Map<string, ForecastType[]>();
    for (const t of this.typesSignal()) {
      groups.set(t.groupTitle, [...(groups.get(t.groupTitle) ?? []), t]);
    }
    return [...groups.entries()].map(([title, types]) => ({ title, types }));
  });

  load(): void {
    this.http
      .get<ForecastEntry[]>(`${this.api}/forecasts`, { params: this.ui.dateParams() })
      .subscribe((list) => this.entriesSignal.set(list));
    if (!this.typesSignal().length) {
      this.http.get<ForecastType[]>(`${this.api}/forecasts/types`).subscribe((t) => this.typesSignal.set(t));
    }
  }

  openDrawer(entry: ForecastEntry | null = null): void {
    this.editing.set(entry);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.editing.set(null);
  }

  readonly active = computed(() => this.entriesSignal().filter((e) => !e.excluded));

  readonly expectedInflow = computed(() =>
    this.active()
      .filter((e) => e.direction === 'Inflow')
      .reduce((sum, e) => sum + Math.abs(e.volume), 0),
  );

  readonly expectedOutflow = computed(() =>
    this.active()
      .filter((e) => e.direction === 'Outflow')
      .reduce((sum, e) => sum - Math.abs(e.volume), 0),
  );

  readonly netForecast = computed(() => this.expectedInflow() + this.expectedOutflow());

  add(input: ForecastInput): Observable<ForecastEntry> {
    return this.http
      .post<ForecastEntry>(`${this.api}/forecasts`, { ...input, volume: Math.abs(input.volume) }, this.quiet())
      .pipe(tap(() => this.load()));
  }

  update(id: string, input: ForecastInput): Observable<ForecastEntry> {
    return this.http
      .put<ForecastEntry>(`${this.api}/forecasts/${id}`, { ...input, volume: Math.abs(input.volume) }, this.quiet())
      .pipe(tap(() => this.load()));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/forecasts/${id}`).pipe(tap(() => this.load()));
  }

  toggleExcluded(id: string): void {
    const entry = this.entriesSignal().find((e) => e.id === id);
    if (!entry) return;
    this.http
      .patch<ForecastEntry>(`${this.api}/forecasts/${id}/exclusion`, { excluded: !entry.excluded })
      .subscribe((updated) => this.entriesSignal.update((list) => list.map((e) => (e.id === id ? updated : e))));
  }

  private quiet() {
    return { context: new HttpContext().set(SKIP_ERROR_TOAST, true) };
  }
}
