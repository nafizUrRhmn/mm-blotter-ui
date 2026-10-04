import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'crore', standalone: true })
export class CrorePipe implements PipeTransform {
  transform(value: number | null | undefined, showSign = false): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    const sign = showSign && value > 0 ? '+' : '';
    //   (non-breaking space) keeps the unit glued to the number so it
    // never wraps onto its own line inside a narrow flex/grid cell.
    return `${sign}${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })} cr.`;
  }
}
