import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Reusable page header: a title (and optional subtitle) on the left,
 * with a projected content area on the right for actions/filters/buttons.
 * Drop into any feature page instead of hand-rolling the same header markup.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-2">
      <div>
        <h1 class="fs-3 fw-bold mb-0">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="text-muted mb-0 small">{{ subtitle() }}</p>
        }
      </div>
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
