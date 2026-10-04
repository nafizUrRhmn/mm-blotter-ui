import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { UiStateService } from '../../core/services/ui-state.service';
import { CommonModule } from '@angular/common';
import { RtgsService } from './rtgs.service';
import { RtgsSubCardComponent } from '../../shared/components/rtgs-sub-card/rtgs-sub-card';
import { CrorePipe } from '../../shared/pipes/crore.pipe';
import { Icon } from '../../shared/components/icon/icon';
import { PageHeader } from '../../shared/components/page-header/page-header';

@Component({
  selector: 'app-rtgs',
  standalone: true,
  imports: [CommonModule, RtgsSubCardComponent, CrorePipe, Icon, PageHeader],
  templateUrl: './rtgs.html',
  styleUrl: './rtgs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rtgs {
  readonly service = inject(RtgsService);
  readonly balanceBreakdownOpen = signal(false);

  constructor() {
    const ui = inject(UiStateService);
    effect(() => {
      ui.refreshTick();
      ui.date();
      untracked(() => this.service.load());
    });
  }

  toggleBalanceBreakdown(): void {
    this.balanceBreakdownOpen.update((v) => !v);
  }

  groupClass(group: string): string {
    switch (group) {
      case 'Live':
        return 'text-bg-success-subtle text-success-emphasis';
      case 'Approval Given':
        return 'text-bg-primary-subtle text-primary-emphasis';
      case 'Approval Pending':
        return 'text-bg-danger-subtle text-danger-emphasis';
      default:
        return 'text-bg-warning-subtle text-warning-emphasis';
    }
  }

  typeDotClass(type: string): string {
    switch (type) {
      case 'Call':
        return 'bg-primary';
      case 'SND':
        return 'bg-success';
      case 'Term':
        return 'bg-info';
      case 'Swap':
        return 'bg-warning';
      case 'FX Outright':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  }

  statusTextClass(status: string): string {
    switch (status) {
      case 'Settled':
        return 'text-success';
      case 'Processing':
        return 'text-primary';
      case 'Pending':
        return 'text-danger';
      default:
        return 'text-muted';
    }
  }
}
