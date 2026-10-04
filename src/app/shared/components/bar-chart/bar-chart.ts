import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BarGroup } from '../../../features/dashboard/dashboard.model';

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bar-chart.html',
  styleUrl: './bar-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarChart {
  readonly data = input.required<BarGroup[]>();
  readonly seriesLabels = input<string[]>(['Series A', 'Series B']);
  readonly seriesColors = input<string[]>(['var(--bs-primary)', 'var(--bs-success)']);
  readonly suffix = input(' cr.');

  readonly hover = signal<{ group: string; series: number; value: number } | null>(null);

  readonly max = computed(() => Math.max(1, ...this.data().flatMap((g) => g.values)));

  barHeight(value: number): number {
    return Math.max(2, (value / this.max()) * 100);
  }

  setHover(group: string, series: number, value: number): void {
    this.hover.set({ group, series, value });
  }

  clearHover(): void {
    this.hover.set(null);
  }
}
