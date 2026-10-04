import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ForecastDataService } from '../forecast-data.service';
import { ForecastEntry, ForecastType, SettlementMethod } from '../forecast.model';
import { UiStateService } from '../../../core/services/ui-state.service';
import { AuthService } from '../../../core/services/auth.service';
import { problemMessage } from '../../../core/api/api.config';
import { CrorePipe } from '../../../shared/pipes/crore.pipe';
import { Icon } from '../../../shared/components/icon/icon';
import { ApiRoles } from '../../../core/auth/api-roles';

/**
 * Add Forecast drawer (BRS §1.11): one button per deal type, the entry form (current or a
 * future date), and below it the forecasts of the date with edit and delete.
 */
@Component({
  selector: 'app-add-forecast-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, CrorePipe, Icon],
  templateUrl: './add-forecast-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddForecastDrawer {
  readonly service = inject(ForecastDataService);
  private readonly ui = inject(UiStateService);
  private readonly auth = inject(AuthService);

  readonly open = this.service.drawerOpen;
  readonly groups = this.service.typeGroups;
  readonly editing = this.service.editing;
  readonly methods: SettlementMethod[] = ['RTGS', 'BB Chq', 'Other'];

  readonly selectedType = signal<ForecastType | null>(null);
  counterparty = '';
  volume: number | null = null;
  expectedTime = '';
  businessDate = '';
  settlementMethod: SettlementMethod = 'RTGS';

  readonly error = signal<string | null>(null);
  readonly saving = signal(false);

  readonly minDate = computed(() => this.ui.businessDate() ?? '');
  readonly canCreate = computed(() => this.auth.hasPermission(ApiRoles.FORECAST_CREATE));
  readonly editable = computed(() => this.service.entries().filter((e) => e.editable));

  constructor() {
    effect(() => {
      const entry = this.editing();
      if (this.open()) this.fill(entry);
    });
  }

  selectType(t: ForecastType): void {
    this.selectedType.set(t);
    this.error.set(null);
  }

  edit(entry: ForecastEntry): void {
    this.service.editing.set(entry);
  }

  remove(entry: ForecastEntry): void {
    if (!confirm(`Delete the ${entry.type} forecast for ${entry.counterparty}? It is kept in the audit trail.`)) return;
    this.service.delete(entry.id).subscribe(() => {
      if (this.editing()?.id === entry.id) this.service.editing.set(null);
    });
  }

  close(): void {
    this.service.closeDrawer();
    this.error.set(null);
  }

  submit(): void {
    const type = this.selectedType();
    if (!type || !this.counterparty.trim() || !this.volume || this.volume <= 0 || !this.expectedTime.trim()) {
      this.error.set('Pick a forecast type and fill in counterparty, a positive volume and the expected time.');
      return;
    }
    const input = {
      forecastTypeKey: type.key,
      counterparty: this.counterparty.trim(),
      volume: this.volume,
      expectedTime: this.expectedTime.trim(),
      businessDate: this.businessDate || null,
      settlementMethod: this.settlementMethod,
    };
    const current = this.editing();
    this.saving.set(true);
    (current ? this.service.update(current.id, input) : this.service.add(input)).subscribe({
      next: () => {
        this.saving.set(false);
        this.service.editing.set(null);
        this.fill(null);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(problemMessage(err));
      },
    });
  }

  private fill(entry: ForecastEntry | null): void {
    this.error.set(null);
    this.selectedType.set(entry ? (this.service.types().find((t) => t.key === entry.forecastTypeKey) ?? null) : null);
    this.counterparty = entry?.counterparty ?? '';
    this.volume = entry ? Math.abs(entry.volume) : null;
    this.expectedTime = entry?.expectedTime ?? '';
    this.businessDate = entry?.businessDate ?? this.ui.date() ?? '';
    this.settlementMethod = entry?.settlementMethod ?? 'RTGS';
  }
}
