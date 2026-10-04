import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../../core/api/api.config';
import { UiStateService } from '../../core/services/ui-state.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { CrorePipe } from '../../shared/pipes/crore.pipe';
import { Icon } from '../../shared/components/icon/icon';

interface FlowChannel {
  code: string;
  card: 'CUSTOMER' | 'OTHER' | 'GSEC';
  rowCode: string;
  rowLabel: string;
  label: string;
  manualAllowed: boolean;
  sourceLabel?: string;
}

interface FlowEntry {
  id: string;
  businessDate: string;
  channelCode: string;
  amount: number;
  counterparty?: string;
  source: string;
  remarks?: string;
  enteredBy: string;
  createdAt: string;
}

const CARD_TITLES: Record<FlowChannel['card'], string> = {
  CUSTOMER: 'Card 8 · Customer Inflow / Outflow',
  OTHER: 'Card 9 · Other Modes',
  GSEC: 'Card 7 · G-Sec (own)',
};

/**
 * Manual channel inputs that have no system feed (BRS §1.4.5–1.4.6): Bangla QR, EFT session 1,
 * BB cheques, ACS bKash / payment gateway, IBCM, early refinance settlement, own G-Sec flows.
 * Current day only; each entry is audit-logged and flows straight into the Overview cards.
 */
@Component({
  selector: 'app-manual-inputs',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeader, CrorePipe, Icon],
  template: `
    <app-page-header title="Manual Inputs">
      <span class="text-muted small">{{ ui.selectedDate() }}</span>
    </app-page-header>

    <div class="row g-4">
      <div class="col-12 col-lg-4">
        <div class="card">
          <div class="card-body d-flex flex-column gap-3">
            <div class="fw-bold">New entry</div>
            @if (!ui.isToday()) {
              <div class="alert alert-warning small mb-0">Manual flows can only be entered on the current day's blotter.</div>
            } @else {
              <div>
                <label class="form-label small fw-semibold text-muted" for="mi-channel">Channel</label>
                <select id="mi-channel" class="form-select" [(ngModel)]="channelCode">
                  @for (g of grouped(); track g.card) {
                    <optgroup [label]="g.title">
                      @for (c of g.channels; track c.code) {
                        <option [value]="c.code">{{ c.rowLabel }} — {{ c.label }}</option>
                      }
                    </optgroup>
                  }
                </select>
              </div>
              <div class="btn-group w-100" role="group" aria-label="Direction">
                <button type="button" class="btn" [class.btn-success]="direction === 'IN'" [class.btn-outline-secondary]="direction !== 'IN'" (click)="direction = 'IN'">Inflow (+)</button>
                <button type="button" class="btn" [class.btn-danger]="direction === 'OUT'" [class.btn-outline-secondary]="direction !== 'OUT'" (click)="direction = 'OUT'">Outflow (−)</button>
              </div>
              <div>
                <label class="form-label small fw-semibold text-muted" for="mi-amount">Amount (Cr.)</label>
                <input id="mi-amount" type="number" min="0.01" step="any" class="form-control" [(ngModel)]="amount" />
              </div>
              <div>
                <label class="form-label small fw-semibold text-muted" for="mi-cp">Counterparty (optional)</label>
                <input id="mi-cp" type="text" maxlength="160" class="form-control" [(ngModel)]="counterparty" />
              </div>
              <div>
                <label class="form-label small fw-semibold text-muted" for="mi-remarks">Remarks</label>
                <input id="mi-remarks" type="text" maxlength="300" class="form-control" [(ngModel)]="remarks" />
              </div>
              <button class="btn btn-dark d-inline-flex align-items-center justify-content-center gap-2" type="button"
                [disabled]="!channelCode || !amount || amount <= 0 || saving()" (click)="add()">
                <app-icon name="plus" size="14" /> Add entry
              </button>
            }
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-8">
        <div class="card">
          <div class="card-header bg-body fw-bold d-flex justify-content-between">
            <span>Manual entries</span>
            <span [class.text-success]="net() >= 0" [class.text-danger]="net() < 0">{{ net() | crore: true }}</span>
          </div>
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0 small">
              <thead>
                <tr><th>Time</th><th>Channel</th><th>Counterparty</th><th>Remarks</th><th class="text-end">Amount</th><th>By</th><th></th></tr>
              </thead>
              <tbody>
                @for (e of entries(); track e.id) {
                  <tr>
                    <td class="text-nowrap">{{ e.createdAt | date: 'shortTime' }}</td>
                    <td>{{ channelLabel(e.channelCode) }}</td>
                    <td>{{ e.counterparty }}</td>
                    <td>{{ e.remarks }}</td>
                    <td class="text-end fw-semibold" [class.text-success]="e.amount >= 0" [class.text-danger]="e.amount < 0">{{ e.amount | crore: true }}</td>
                    <td>{{ e.enteredBy }}</td>
                    <td class="text-end">
                      @if (ui.isToday()) {
                        <button class="btn btn-sm btn-link text-danger p-0" type="button" title="Delete" (click)="remove(e)"><app-icon name="trash" size="14" /></button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="7" class="text-center text-muted py-5">No manual entries on this date.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManualInputs {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  readonly ui = inject(UiStateService);

  readonly channels = signal<FlowChannel[]>([]);
  readonly entries = signal<FlowEntry[]>([]);
  readonly saving = signal(false);

  channelCode = '';
  direction: 'IN' | 'OUT' = 'IN';
  amount: number | null = null;
  counterparty = '';
  remarks = '';

  readonly grouped = computed(() =>
    (['CUSTOMER', 'OTHER', 'GSEC'] as const)
      .map((card) => ({ card, title: CARD_TITLES[card], channels: this.channels().filter((c) => c.card === card) }))
      .filter((g) => g.channels.length),
  );
  readonly net = computed(() => this.entries().reduce((s, e) => s + e.amount, 0));

  constructor() {
    this.http.get<FlowChannel[]>(`${this.api}/reference/flow-channels`, { params: { manualOnly: true } }).subscribe((list) => {
      this.channels.set(list);
      if (!this.channelCode && list.length) this.channelCode = list[0].code;
    });
    effect(() => {
      this.ui.refreshTick();
      this.ui.date();
      untracked(() => this.load());
    });
  }

  channelLabel(code: string): string {
    const c = this.channels().find((x) => x.code === code);
    return c ? `${c.rowLabel} — ${c.label}` : code;
  }

  add(): void {
    if (!this.channelCode || !this.amount || this.amount <= 0) return;
    this.saving.set(true);
    this.http
      .post<FlowEntry>(`${this.api}/manual-flows`, {
        channelCode: this.channelCode,
        direction: this.direction,
        amount: this.amount,
        counterparty: this.counterparty || null,
        remarks: this.remarks || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.amount = null;
          this.counterparty = '';
          this.remarks = '';
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }

  remove(e: FlowEntry): void {
    this.http.delete<void>(`${this.api}/manual-flows/${e.id}`).subscribe(() => this.load());
  }

  private load(): void {
    this.http
      .get<FlowEntry[]>(`${this.api}/manual-flows`, { params: this.ui.dateParams() })
      .subscribe((list) => this.entries.set(list));
  }
}
