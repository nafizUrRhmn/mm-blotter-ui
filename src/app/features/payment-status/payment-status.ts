import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiStateService } from '../../core/services/ui-state.service';
import { DealDetailsService } from '../deal-details/deal-details.service';
import { Deal, SettlementStatus } from '../deal-details/deal.model';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { CrorePipe } from '../../shared/pipes/crore.pipe';

type StatusFilter = 'All' | SettlementStatus;

interface PaymentRow extends Deal {
  bucketTitle: string;
}

/**
 * Payment Status: settlement status of every booked deal of the selected day (New and Maturity),
 * one line per deal. RTGS deals are matched with Iflash; others (BB Chq, G-Sec) are maintained by
 * hand on Deal Details. Forecasts are not payments yet, so they are left out.
 */
@Component({
  selector: 'app-payment-status',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeader, CrorePipe],
  template: `
    <app-page-header title="Payment Status"></app-page-header>

    <div class="row g-4 mb-4">
      <div class="col-6 col-lg-3">
        <button type="button" class="card h-100 w-100 text-start stat-filter" [class.border-primary]="status() === 'All'" (click)="status.set('All')">
          <span class="card-body d-block">
            <span class="text-muted small d-block">Total Deals</span>
            <span class="fs-3 fw-bold">{{ rows().length }}</span>
          </span>
        </button>
      </div>
      <div class="col-6 col-lg-3">
        <button type="button" class="card h-100 w-100 text-start stat-filter" [class.border-success]="status() === 'Settled'" (click)="status.set('Settled')">
          <span class="card-body d-block">
            <span class="text-muted small d-block">Settled</span>
            <span class="fs-3 fw-bold text-success">{{ counts().Settled }}</span>
          </span>
        </button>
      </div>
      <div class="col-6 col-lg-3">
        <button type="button" class="card h-100 w-100 text-start stat-filter" [class.border-warning]="status() === 'Processing'" (click)="status.set('Processing')">
          <span class="card-body d-block">
            <span class="text-muted small d-block">Processing</span>
            <span class="fs-3 fw-bold text-warning">{{ counts().Processing }}</span>
          </span>
        </button>
      </div>
      <div class="col-6 col-lg-3">
        <button type="button" class="card h-100 w-100 text-start stat-filter" [class.border-danger]="status() === 'Pending'" (click)="status.set('Pending')">
          <span class="card-body d-block">
            <span class="text-muted small d-block">Pending</span>
            <span class="fs-3 fw-bold text-danger">{{ counts().Pending }}</span>
          </span>
        </button>
      </div>
    </div>

    <div class="border rounded-pill px-3 py-2 small text-muted mb-4 bg-body">
      Showing {{ ui.isToday() ? "today's" : 'the' }} payment status for {{ ui.selectedDate() }}
      @if (status() !== 'All') {
        · filtered to <span class="fw-semibold">{{ status() }}</span>
        <button type="button" class="btn btn-link btn-sm p-0 ms-1 align-baseline" (click)="status.set('All')">show all</button>
      }
    </div>

    <div class="card">
      <div class="card-header bg-body fw-bold">{{ ui.isToday() ? "Today's" : '' }} Payment Status</div>
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">Deal Type</th>
              <th scope="col">Deal No</th>
              <th scope="col">Card</th>
              <th scope="col">Counterparty</th>
              <th scope="col" class="text-end">Vol. (Cr.)</th>
              <th scope="col">Payment Mode</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            @for (row of filtered(); track row.id) {
              <tr>
                <td class="fw-semibold">{{ row.type }}</td>
                <td class="text-nowrap">{{ row.dealNo }}</td>
                <td class="text-muted small">{{ row.bucketTitle }}</td>
                <td>{{ row.counterparty }}</td>
                <td class="text-end fw-semibold" [class.text-success]="row.volume >= 0" [class.text-danger]="row.volume < 0">
                  {{ row.volume | crore: true }}
                </td>
                <td>{{ row.paymentStatus }}</td>
                <td>
                  <span class="badge rounded-pill" [ngClass]="statusClass(row.settlementStatus)">{{ row.settlementStatus ?? '—' }}</span>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="text-center text-muted py-5">No deals to show.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [
    `
      .stat-filter {
        cursor: pointer;
        transition: border-color 150ms ease;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentStatus {
  private readonly deals = inject(DealDetailsService);
  readonly ui = inject(UiStateService);

  readonly status = signal<StatusFilter>('All');

  /** Booked deals only (FT deals have a deal no; forecasts and G-Sec registry flows are not payments). */
  readonly rows = computed<PaymentRow[]>(() =>
    this.deals
      .data()
      .flatMap((g) => g.deals.map((d) => ({ ...d, bucketTitle: g.title })))
      .filter((d) => !d.forecast && !!d.dealNo && !!d.settlementStatus),
  );

  readonly counts = computed(() => {
    const c: Record<SettlementStatus, number> = { Settled: 0, Processing: 0, Pending: 0 };
    this.rows().forEach((r) => r.settlementStatus && c[r.settlementStatus]++);
    return c;
  });

  readonly filtered = computed(() => {
    const s = this.status();
    return s === 'All' ? this.rows() : this.rows().filter((r) => r.settlementStatus === s);
  });

  constructor() {
    effect(() => {
      this.ui.refreshTick();
      this.ui.date();
      untracked(() => this.deals.load());
    });
  }

  statusClass(status: string | null | undefined): string {
    if (status === 'Settled') return 'text-bg-success-subtle text-success-emphasis';
    if (status === 'Processing') return 'text-bg-warning-subtle text-warning-emphasis';
    return 'text-bg-danger-subtle text-danger-emphasis';
  }
}
