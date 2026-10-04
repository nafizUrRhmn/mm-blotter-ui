import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InstrumentCardConfig } from '../../../features/overview/instrument-card.model';
import { CrorePipe } from '../../pipes/crore.pipe';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-instrument-card',
  standalone: true,
  imports: [CommonModule, CrorePipe, Icon],
  templateUrl: './instrument-card.html',
  styleUrl: './instrument-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstrumentCard {
  readonly config = input.required<InstrumentCardConfig>();

  readonly expandedRow = signal<string | null>(null);

  readonly total = computed(() => this.config().rows.reduce((sum, row) => sum + row.net, 0));
  readonly accent = computed(() => this.config().accent ?? 'primary');

  toggleRow(key: string): void {
    this.expandedRow.update((current) => (current === key ? null : key));
  }
}
