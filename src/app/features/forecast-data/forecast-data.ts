import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ForecastDataService } from './forecast-data.service';
import { AddForecastDrawer } from './add-forecast-drawer/add-forecast-drawer';
import { CrorePipe } from '../../shared/pipes/crore.pipe';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { UiStateService } from '../../core/services/ui-state.service';
import { AuthService } from '../../core/services/auth.service';
import { ForecastDirection, ForecastEntry } from './forecast.model';
import { ApiRoles } from '../../core/auth/api-roles';

@Component({
  selector: 'app-forecast-data',
  standalone: true,
  imports: [CommonModule, AddForecastDrawer, CrorePipe, PageHeader],
  templateUrl: './forecast-data.html',
  styleUrl: './forecast-data.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForecastData {
  readonly service = inject(ForecastDataService);
  readonly ui = inject(UiStateService);
  private readonly auth = inject(AuthService);

  readonly entries = this.service.entries;
  readonly expectedInflow = this.service.expectedInflow;
  readonly expectedOutflow = this.service.expectedOutflow;
  readonly netForecast = this.service.netForecast;

  /** Grouped by inflow / outflow, then by deal type (BRS §1.10). */
  readonly sections = computed(() =>
    (['Inflow', 'Outflow'] as ForecastDirection[]).map((direction) => {
      const byType = new Map<string, ForecastEntry[]>();
      for (const e of this.entries().filter((x) => x.direction === direction)) {
        byType.set(e.type, [...(byType.get(e.type) ?? []), e]);
      }
      return { direction, groups: [...byType.entries()].map(([type, rows]) => ({ type, rows })) };
    }),
  );

  readonly canCreate = computed(() => this.auth.hasPermission(ApiRoles.FORECAST_CREATE));
  readonly canExclude = computed(() => this.auth.hasPermission(ApiRoles.FORECAST_EXCLUDE));
  /** Past blotters are read-only; forecasts may be added for today and future dates. */
  readonly openDay = computed(() => {
    const d = this.ui.date();
    const today = this.ui.businessDate();
    return !d || !today || d >= today;
  });

  constructor() {
    effect(() => {
      this.ui.refreshTick();
      this.ui.date();
      untracked(() => this.service.load());
    });
  }

  toggleExcluded(id: string): void {
    this.service.toggleExcluded(id);
  }
}
