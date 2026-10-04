import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RtgsSubCard } from '../../../features/rtgs/rtgs.model';
import { CrorePipe } from '../../pipes/crore.pipe';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-rtgs-sub-card',
  standalone: true,
  imports: [CommonModule, CrorePipe, Icon],
  templateUrl: './rtgs-sub-card.html',
  styleUrl: './rtgs-sub-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RtgsSubCardComponent {
  readonly card = input.required<RtgsSubCard>();
  readonly defaultOpen = input(true);

  readonly open = signal(true);
  private initialized = false;

  ngOnChanges(): void {
    if (!this.initialized) {
      this.open.set(this.defaultOpen());
      this.initialized = true;
    }
  }

  toggle(): void {
    this.open.update((v) => !v);
  }

  statusClass(status: string): string {
    switch (status) {
      case 'Settled':
        return 'text-bg-success-subtle text-success-emphasis';
      case 'Processing':
        return 'text-bg-primary-subtle text-primary-emphasis';
      default:
        return 'text-bg-danger-subtle text-danger-emphasis';
    }
  }

  typeClass(type: string): string {
    switch (type) {
      case 'Call':
        return 'text-bg-primary-subtle text-primary-emphasis';
      case 'SND':
        return 'text-bg-success-subtle text-success-emphasis';
      case 'Term':
        return 'text-bg-info-subtle text-info-emphasis';
      case 'Swap':
        return 'text-bg-warning-subtle text-warning-emphasis';
      case 'FX Outright':
        return 'text-bg-danger-subtle text-danger-emphasis';
      default:
        return 'text-bg-secondary-subtle text-secondary-emphasis';
    }
  }
}
