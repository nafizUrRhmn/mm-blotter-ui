import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiStateService } from '../../core/services/ui-state.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { FxService, millions } from './fx.service';

/** FC Placement: foreign-currency money-market placements outstanding on the blotter date. */
@Component({
  selector: 'app-fc-placement',
  standalone: true,
  imports: [CommonModule, PageHeader],
  template: `
    <app-page-header title="FC Placement"></app-page-header>

    @if (data(); as d) {
      <div class="row g-4 mb-4">
        @for (t of d.totals; track t.currency) {
          <div class="col-6 col-lg-3">
            <div class="card h-100"><div class="card-body">
              <div class="text-muted small">{{ t.currency }} Placements</div>
              <div class="fs-3 fw-bold">{{ t.symbol }}{{ m(t.amount, 0) }}M</div>
            </div></div>
          </div>
        }
        <div class="col-6 col-lg-3">
          <div class="card h-100"><div class="card-body">
            <div class="text-muted small">Weighted Avg. Rate</div>
            <div class="fs-3 fw-bold text-success">{{ d.weightedAvgRate != null ? (d.weightedAvgRate | number: '1.2-2') + '%' : '—' }}</div>
          </div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-header bg-body fw-bold">Active FC Placements</div>
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Bank</th>
                <th class="text-center">Currency</th>
                <th class="text-end">Amount (M)</th>
                <th class="text-end">Rate (%)</th>
                <th class="text-center">Maturity</th>
                <th class="text-end">Days</th>
                <th class="text-end">Interest (M)</th>
              </tr>
            </thead>
            <tbody>
              @for (p of d.placements; track p.dealNo) {
                <tr [title]="p.dealNo + ' · value date ' + p.valueDate">
                  <td class="fw-semibold">{{ p.bank }}</td>
                  <td class="text-center">{{ p.currency }}</td>
                  <td class="text-end">{{ m(p.amount, 1) }}</td>
                  <td class="text-end text-success">{{ p.rate | number: '1.2-2' }}</td>
                  <td class="text-center text-muted">{{ p.maturityDate | date: 'dd-MMM' }}</td>
                  <td class="text-end">{{ p.days }}</td>
                  <td class="text-end text-success">{{ m(p.interest, 2) }}</td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="text-center text-muted py-5">No active FC placements.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FcPlacement {
  private readonly fx = inject(FxService);
  private readonly ui = inject(UiStateService);
  readonly data = this.fx.placements;

  constructor() {
    effect(() => {
      this.ui.refreshTick();
      this.ui.date();
      untracked(() => this.fx.loadPlacements());
    });
  }

  m(value: number, digits: number): string {
    return millions(value, false, digits);
  }
}
