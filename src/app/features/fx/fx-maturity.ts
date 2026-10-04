import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiStateService } from '../../core/services/ui-state.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { FxService, millions } from './fx.service';

/** FX Maturity: outstanding FX contracts by value date for the coming week (USD millions). */
@Component({
  selector: 'app-fx-maturity',
  standalone: true,
  imports: [CommonModule, PageHeader],
  template: `
    <app-page-header title="FX Maturity">
      @if (data(); as d) {
        <span class="text-muted small">{{ d.from | date: 'dd MMM' }} – {{ d.to | date: 'dd MMM yyyy' }} · USD equivalent</span>
      }
    </app-page-header>

    @if (data(); as d) {
      <div class="row g-4 mb-4">
        <div class="col-12 col-md-4">
          <div class="card h-100"><div class="card-body">
            <div class="text-muted small">Week Total Buy</div>
            <div class="fs-3 fw-bold text-success">{{ usd(d.totalBuy, true) }}</div>
          </div></div>
        </div>
        <div class="col-12 col-md-4">
          <div class="card h-100"><div class="card-body">
            <div class="text-muted small">Week Total Sell</div>
            <div class="fs-3 fw-bold text-danger">{{ usd(d.totalSell, true) }}</div>
          </div></div>
        </div>
        <div class="col-12 col-md-4">
          <div class="card h-100"><div class="card-body">
            <div class="text-muted small">Net Position</div>
            <div class="fs-3 fw-bold" [class.text-success]="d.netPosition >= 0" [class.text-danger]="d.netPosition < 0">{{ usd(d.netPosition, true) }}</div>
          </div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-header bg-body fw-bold">Daily FX Maturity Schedule</div>
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Date</th>
                <th class="text-end">Buy (M)</th>
                <th class="text-end">Sell (M)</th>
                <th class="text-end">Net (M)</th>
                <th class="text-end" title="Buy volume on spot contracts">Spot</th>
                <th class="text-end" title="Buy volume on forward contracts">Forward</th>
              </tr>
            </thead>
            <tbody>
              @for (r of d.days; track r.date) {
                <tr>
                  <td class="fw-semibold">{{ r.label }}</td>
                  <td class="text-end text-success">{{ m(r.buy, true) }}</td>
                  <td class="text-end text-danger">{{ m(r.sell, true) }}</td>
                  <td class="text-end fw-semibold" [class.text-success]="r.net >= 0" [class.text-danger]="r.net < 0">{{ m(r.net, true) }}</td>
                  <td class="text-end">{{ m(r.spot) }}</td>
                  <td class="text-end">{{ m(r.forward) }}</td>
                </tr>
              }
              <tr class="fw-bold border-top">
                <td>Week Total</td>
                <td class="text-end text-success">{{ m(d.totalBuy, true) }}</td>
                <td class="text-end text-danger">{{ m(d.totalSell, true) }}</td>
                <td class="text-end" [class.text-success]="d.netPosition >= 0" [class.text-danger]="d.netPosition < 0">{{ m(d.netPosition, true) }}</td>
                <td class="text-end text-muted">-</td>
                <td class="text-end text-muted">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FxMaturity {
  private readonly fx = inject(FxService);
  private readonly ui = inject(UiStateService);
  readonly data = this.fx.maturity;
  readonly m = millions;

  constructor() {
    effect(() => {
      this.ui.refreshTick();
      this.ui.date();
      untracked(() => this.fx.loadMaturity());
    });
  }

  /** +$37.2M */
  usd(value: number, signed = false): string {
    const text = millions(Math.abs(value));
    return (value < 0 ? '-' : signed && value > 0 ? '+' : '') + '$' + text + 'M';
  }
}
