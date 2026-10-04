import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toasts',
  standalone: true,
  template: `
    <div class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 1090;" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast show align-items-center border-0" [class]="'text-bg-' + toast.tone" role="alert">
          <div class="d-flex">
            <div class="toast-body small">{{ toast.message }}</div>
            <button
              type="button"
              class="btn-close btn-close-white me-2 m-auto"
              aria-label="Close"
              (click)="toasts.dismiss(toast.id)"
            ></button>
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toasts {
  readonly toasts = inject(ToastService);
}
