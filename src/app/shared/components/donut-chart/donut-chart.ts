import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DonutSlice } from '../../../features/dashboard/dashboard.model';

const SIZE = 160;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

@Component({
  selector: 'app-donut-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './donut-chart.html',
  styleUrl: './donut-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DonutChart {
  readonly data = input.required<DonutSlice[]>();
  readonly suffix = input(' cr.');

  readonly size = SIZE;
  readonly radius = RADIUS;
  readonly center = SIZE / 2;
  readonly strokeWidth = STROKE;

  readonly hoverIndex = signal<number | null>(null);

  readonly total = computed(() => this.data().reduce((sum, d) => sum + d.value, 0));

  readonly segments = computed(() => {
    const total = this.total() || 1;
    let offset = 0;
    return this.data().map((slice, i) => {
      const fraction = slice.value / total;
      const length = fraction * CIRCUMFERENCE;
      const segment = {
        ...slice,
        index: i,
        percent: Math.round(fraction * 100),
        dashArray: `${length} ${CIRCUMFERENCE - length}`,
        dashOffset: -offset,
      };
      offset += length;
      return segment;
    });
  });

  readonly hovered = computed(() => {
    const idx = this.hoverIndex();
    return idx === null ? null : this.segments()[idx];
  });

  setHover(index: number): void {
    this.hoverIndex.set(index);
  }

  clearHover(): void {
    this.hoverIndex.set(null);
  }
}
