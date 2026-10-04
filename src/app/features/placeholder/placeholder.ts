import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { PageHeader } from '../../shared/components/page-header/page-header';

@Component({
  selector: 'app-placeholder',
  standalone: true,
  imports: [PageHeader],
  template: `
    <app-page-header [title]="title()"></app-page-header>
    <div class="border border-dashed rounded-4 p-5 text-center text-muted mt-4">
      <p class="mb-0">This dashboard is coming soon. Configure it in <code>app.routes.ts</code> once its data model is ready.</p>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .border-dashed {
        border-style: dashed !important;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Placeholder {
  private readonly route = inject(ActivatedRoute);
  readonly title = toSignal(this.route.data.pipe(map((d) => (d['title'] as string) ?? 'Coming soon')), {
    initialValue: 'Coming soon',
  });
}
