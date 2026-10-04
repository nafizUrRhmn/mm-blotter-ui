import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

/**
 * Renders its content only when the user holds the ACS API role (or any of a list). Values are
 * ACS role ids from `ApiRoles` (e.g. `MMB_FORECAST_CTRL`), taken from the access token's `roles`:
 *
 *   <button *appHasPermission="R.FORECAST_CREATE">+ Add Forecast</button>   (R = ApiRoles)
 *   <div *appHasPermission="[R.RECON_WRITE, R.ROC_WRITE]">…</div>
 *
 * Reacts to session changes. UI gating only — the API enforces the same rule.
 */
@Directive({ selector: '[appHasPermission]', standalone: true })
export class HasPermission {
  private readonly auth = inject(AuthService);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);

  readonly appHasPermission = input.required<string | string[]>();

  private rendered = false;

  constructor() {
    effect(() => {
      const required = this.appHasPermission();
      const allowed = this.auth.hasAnyPermission(Array.isArray(required) ? required : [required]);
      if (allowed && !this.rendered) {
        this.container.createEmbeddedView(this.template);
        this.rendered = true;
      } else if (!allowed && this.rendered) {
        this.container.clear();
        this.rendered = false;
      }
    });
  }
}
