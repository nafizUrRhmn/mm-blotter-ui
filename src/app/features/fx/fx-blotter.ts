import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiStateService } from '../../core/services/ui-state.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { Icon } from '../../shared/components/icon/icon';
import { FxService, fxAmount } from './fx.service';

/** FX Blotter: BDT rate cards, DBU / OBU currency positions and nostro-wise balances. */
@Component({
  selector: 'app-fx-blotter',
  standalone: true,
  imports: [CommonModule, PageHeader, Icon],
  template: `
    <app-page-header title="FX Blotter">
      @if (data()?.asOf && data()!.asOf !== data()!.businessDate) {
        <span class="text-muted small">Latest snapshot: {{ data()!.asOf | date: 'dd MMM yyyy' }}</span>
      }
    </app-page-header>

    @if (data(); as d) {
      <div class="row g-4 mb-4">
        @for (r of d.rates; track r.currency) {
          <div class="col-12 col-md-4">
            <div class="card h-100">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <span class="fw-bold">{{ r.pair }}</span>
                  <span class="small fw-semibold d-inline-flex align-items-center gap-1" [class.text-success]="r.changePct >= 0" [class.text-danger]="r.changePct < 0">
                    <app-icon [name]="r.changePct >= 0 ? 'trending-up' : 'trending-down'" size="14" />
                    {{ r.changePct > 0 ? '+' : '' }}{{ r.changePct | number: '1.2-2' }}%
                  </span>
                </div>
                <div class="d-flex gap-4">
                  <div>
                    <div class="text-muted small">Bid</div>
                    <div class="fs-4 fw-bold">{{ r.bid | number: '1.2-2' }}</div>
                  </div>
                  <div>
                    <div class="text-muted small">Ask</div>
                    <div class="fs-4 fw-bold">{{ r.ask | number: '1.2-2' }}</div>
                  </div>
                </div>
                <div class="d-flex justify-content-between text-muted small mt-3">
                  <span>H: {{ r.high | number: '1.2-2' }}</span>
                  <span>L: {{ r.low | number: '1.2-2' }}</span>
                </div>
              </div>
            </div>
          </div>
        } @empty {
          <div class="col-12 text-muted">No rate sheet received yet.</div>
        }
      </div>

      <ul class="nav nav-pills mb-3">
        @for (u of d.units; track u.unit) {
          <li class="nav-item">
            <button type="button" class="nav-link py-1 px-3" [class.active]="unit() === u.unit" (click)="unit.set(u.unit)">{{ u.unit }}</button>
          </li>
        }
      </ul>

      @if (current(); as u) {
        <div class="position-grid mb-4">
          @for (p of u.positions; track p.currency) {
            <div class="card">
              <div class="card-body py-3">
                <div class="text-muted small">{{ p.currency }}</div>
                <div class="fs-5 fw-bold" [class.text-success]="p.amount >= 0" [class.text-danger]="p.amount < 0">{{ fmt(p.amount) }}</div>
              </div>
            </div>
          } @empty {
            <div class="text-muted">No nostro balances for {{ u.unit }}.</div>
          }
        </div>

        <div class="card">
          <div class="card-header bg-body fw-bold">Nostro-wise Balances</div>
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead>
                <tr><th>Nostro Account</th><th>Currency</th><th class="text-end">Balance</th></tr>
              </thead>
              <tbody>
                @for (n of u.nostros; track n.account + n.currency) {
                  <tr>
                    <td>{{ n.account }}</td>
                    <td>{{ n.currency }}</td>
                    <td class="text-end fw-semibold" [class.text-success]="n.balance >= 0" [class.text-danger]="n.balance < 0">{{ fmt(n.balance, true) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    }
  `,
  styles: [
    `
      .position-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 1rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FxBlotter {
  private readonly fx = inject(FxService);
  private readonly ui = inject(UiStateService);

  readonly data = this.fx.blotter;
  readonly unit = signal<'DBU' | 'OBU'>('DBU');
  readonly current = computed(() => this.data()?.units.find((u) => u.unit === this.unit()) ?? null);
  readonly fmt = fxAmount;

  constructor() {
    effect(() => {
      this.ui.refreshTick();
      this.ui.date();
      untracked(() => this.fx.loadBlotter());
    });
  }
}
