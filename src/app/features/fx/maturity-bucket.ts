import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiStateService } from '../../core/services/ui-state.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { FxService } from './fx.service';

/**
 * Maturity Bucket: today's Dhaka closing rolled forward by the maturities of outstanding MM deals,
 * business day by business day (BDT crore). Columns come from the API.
 */
@Component({
  selector: 'app-maturity-bucket',
  standalone: true,
  imports: [CommonModule, PageHeader],
  template: `
    <app-page-header title="Maturity Bucket"></app-page-header>

    @if (data(); as d) {
      <div class="row g-4 mb-4">
        <div class="col-12 col-md-4">
          <div class="card h-100"><div class="card-body">
            <div class="text-muted small">Starting Balance</div>
            <div class="fs-3 fw-bold">{{ cr(d.startingBalance) }} Cr.</div>
          </div></div>
        </div>
        <div class="col-12 col-md-4">
          <div class="card h-100"><div class="card-body">
            <div class="text-muted small">Total Maturity Impact</div>
            <div class="fs-3 fw-bold" [class.text-success]="d.totalMaturityImpact >= 0" [class.text-danger]="d.totalMaturityImpact < 0">{{ cr(d.totalMaturityImpact, true) }} Cr.</div>
          </div></div>
        </div>
        <div class="col-12 col-md-4">
          <div class="card h-100"><div class="card-body">
            <div class="text-muted small">Final Net Position</div>
            <div class="fs-3 fw-bold" [class.text-success]="d.finalNetPosition >= 0" [class.text-danger]="d.finalNetPosition < 0">{{ cr(d.finalNetPosition, true) }} Cr.</div>
          </div></div>
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-header bg-body fw-bold">Day-wise Maturity Analysis</div>
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0 small">
            <thead>
              <tr>
                <th>Date</th>
                <th class="text-end">Closing Bal.</th>
                @for (c of columns(); track c.id) {
                  <th class="text-end">{{ c.label }}</th>
                }
                <th class="text-end">Total Mat.</th>
                <th class="text-end">Net Position</th>
              </tr>
            </thead>
            <tbody>
              @for (r of d.rows; track r.date) {
                <tr>
                  <td class="fw-semibold text-nowrap">{{ r.label }}</td>
                  <td class="text-end">{{ cr(r.closingBalance) }}</td>
                  @for (c of columns(); track c.id) {
                    <td class="text-end" [class.text-success]="(r.byType[c.id] ?? 0) > 0" [class.text-danger]="(r.byType[c.id] ?? 0) < 0"
                      [class.text-body-tertiary]="!r.byType[c.id]">{{ cell(r.byType[c.id]) }}</td>
                  }
                  <td class="text-end fw-semibold" [class.text-success]="r.totalMaturity > 0" [class.text-danger]="r.totalMaturity < 0">{{ cr(r.totalMaturity, true) }}</td>
                  <td class="text-end fw-bold" [class.text-success]="r.netPosition >= 0" [class.text-danger]="r.netPosition < 0">{{ cr(r.netPosition, true) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header bg-body fw-bold">Deal Type Summary</div>
        <div class="card-body">
          <div class="row g-3">
            @for (s of d.summary; track s.type) {
              <div class="col-12 col-md-4 d-flex justify-content-between small">
                <span class="text-muted">{{ s.type }}</span>
                <span class="fw-semibold" [class.text-success]="s.amount > 0" [class.text-danger]="s.amount < 0">{{ cr(s.amount, true) }} Cr.</span>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaturityBucket {
  private readonly fx = inject(FxService);
  private readonly ui = inject(UiStateService);
  readonly data = this.fx.maturityBucket;

  /** Only columns with at least one maturity in the window (others would be all zeros). */
  readonly columns = computed(() => {
    const d = this.data();
    if (!d) return [];
    return d.columns.filter((c) => d.rows.some((r) => (r.byType[c.id] ?? 0) !== 0));
  });

  constructor() {
    effect(() => {
      this.ui.refreshTick();
      this.ui.date();
      untracked(() => this.fx.loadMaturityBucket());
    });
  }

  cr(value: number, signed = false): string {
    const text = Math.abs(value).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    return (value < 0 ? '-' : signed && value > 0 ? '+' : '') + text;
  }

  cell(value: number | undefined): string {
    return value ? this.cr(value, true) : '0';
  }
}
