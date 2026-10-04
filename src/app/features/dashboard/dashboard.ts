import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from './dashboard.service';
import { LineChart } from '../../shared/components/line-chart/line-chart';
import { BarChart } from '../../shared/components/bar-chart/bar-chart';
import { DonutChart } from '../../shared/components/donut-chart/donut-chart';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { UiStateService } from '../../core/services/ui-state.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, LineChart, BarChart, DonutChart, PageHeader],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly service = inject(DashboardService);

  readonly kpis = this.service.kpis;
  readonly closingTrend = this.service.closingTrend;
  readonly borrowingVsPlacement = this.service.borrowingVsPlacement;
  readonly dealMix = this.service.dealMix;

  constructor() {
    const ui = inject(UiStateService);
    effect(() => {
      ui.refreshTick();
      ui.date();
      untracked(() => this.service.load());
    });
  }
}
