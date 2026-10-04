import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Icon } from '../icon/icon';

export interface StatRow {
  label: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral';
  editable?: boolean;
}

export type StatCardAccent = 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'secondary';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule, Icon],
  templateUrl: './stat-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCard {
  readonly title = input.required<string>();
  readonly value = input<string>();
  readonly delta = input<string>();
  readonly deltaTone = input<'positive' | 'negative' | 'neutral'>('neutral');
  readonly rows = input<StatRow[]>([]);
  readonly variant = input<'default' | 'accent'>('default');

  /** Optional icon (from the shared Icon set) shown in a colored badge next to the title. */
  readonly icon = input<string>();
  /** Bootstrap contextual color driving the icon badge + left accent border. */
  readonly accent = input<StatCardAccent>('primary');
}
