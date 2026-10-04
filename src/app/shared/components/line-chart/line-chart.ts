import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrendPoint } from '../../../features/dashboard/dashboard.model';

const VIEW_W = 600;
const VIEW_H = 220;
const PAD_X = 12;
const PAD_Y = 20;

@Component({
  selector: 'app-line-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './line-chart.html',
  styleUrl: './line-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineChart {
  readonly data = input.required<TrendPoint[]>();
  readonly color = input('var(--bs-primary)');
  readonly suffix = input(' cr.');

  readonly viewBox = `0 0 ${VIEW_W} ${VIEW_H}`;
  readonly hoverIndex = signal<number | null>(null);

  private readonly bounds = computed(() => {
    const values = this.data().map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { min: min === max ? min - 1 : min, max: max === min ? max + 1 : max };
  });

  readonly points = computed(() => {
    const data = this.data();
    const { min, max } = this.bounds();
    const innerW = VIEW_W - PAD_X * 2;
    const innerH = VIEW_H - PAD_Y * 2;
    const step = data.length > 1 ? innerW / (data.length - 1) : 0;

    return data.map((point, i) => {
      const x = PAD_X + step * i;
      const ratio = (point.value - min) / (max - min);
      const y = PAD_Y + innerH * (1 - ratio);
      return { x, y, ...point };
    });
  });

  readonly linePath = computed(() =>
    this.points()
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' '),
  );

  readonly areaPath = computed(() => {
    const pts = this.points();
    if (!pts.length) return '';
    const first = pts[0];
    const last = pts[pts.length - 1];
    return `${this.linePath()} L ${last.x.toFixed(1)} ${VIEW_H - PAD_Y} L ${first.x.toFixed(1)} ${VIEW_H - PAD_Y} Z`;
  });

  readonly hovered = computed(() => {
    const idx = this.hoverIndex();
    return idx === null ? null : this.points()[idx];
  });

  onMove(event: MouseEvent, svg: Element): void {
    const rect = svg.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const pts = this.points();
    if (!pts.length) return;
    const targetX = ratio * VIEW_W;
    let nearest = 0;
    let nearestDist = Infinity;
    pts.forEach((p, i) => {
      const dist = Math.abs(p.x - targetX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    this.hoverIndex.set(nearest);
  }

  onLeave(): void {
    this.hoverIndex.set(null);
  }
}
