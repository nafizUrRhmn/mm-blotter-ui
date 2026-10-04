import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CrrMonitorService } from './crr-monitor.service';
import { CrorePipe } from '../../shared/pipes/crore.pipe';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { Icon } from '../../shared/components/icon/icon';
import { UiStateService } from '../../core/services/ui-state.service';

@Component({
  selector: 'app-crr-monitor',
  standalone: true,
  imports: [CommonModule, CrorePipe, PageHeader, Icon],
  templateUrl: './crr-monitor.html',
  styleUrl: './crr-monitor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrrMonitor {
  private readonly service = inject(CrrMonitorService);
  private readonly ui = inject(UiStateService);

  readonly data = this.service.data;
  /** Month shown; follows the global blotter date until the navigator is used. */
  readonly month = signal<string | null>(null);
  readonly monthLabel = computed(() => {
    const m = this.data()?.month;
    return m ? new Date(`${m}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : '';
  });
  readonly canGoNext = computed(() => {
    const d = this.data();
    const today = this.ui.businessDate();
    return !!d && !!today && d.nextMonth <= today.slice(0, 7);
  });

  constructor() {
    effect(() => {
      const date = this.ui.date();
      untracked(() => this.month.set(date ? date.slice(0, 7) : null));
    });
    effect(() => {
      this.ui.refreshTick();
      const m = this.month();
      untracked(() => this.service.load(m));
    });
  }

  go(month: string | undefined): void {
    if (month) this.month.set(month);
  }
}
