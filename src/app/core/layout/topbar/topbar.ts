import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { ThemeService } from '../../services/theme.service';
import { UiStateService } from '../../services/ui-state.service';
import { NavConfigService } from '../../services/nav-config.service';
import { Icon } from '../../../shared/components/icon/icon';
import { ProfileMenu } from '../../../shared/components/profile-menu/profile-menu';
import { NotificationPanel } from '../../../shared/components/notification-panel/notification-panel';
import { HasPermission } from '../../../shared/directives/has-permission.directive';
import { ApiRoles } from '../../auth/api-roles';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, Icon, ProfileMenu, NotificationPanel, HasPermission],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Topbar {
  /** ACS API role ids, for `*appHasPermission` in the template. */
  readonly R = ApiRoles;

  readonly theme = inject(ThemeService);
  readonly ui = inject(UiStateService);
  private readonly nav = inject(NavConfigService);
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** "<Section> / <Page>" for the current route, taken from the user's server-driven menu. */
  readonly breadcrumb = computed<string[]>(() => {
    const path = this.url().split(/[?#]/)[0];
    for (const section of this.nav.sections()) {
      if (section.id === 'favorites') continue;
      const matches = (route?: string) => !!route && (path === route || path.startsWith(route + '/'));
      for (const item of section.items) {
        if (matches(item.route)) return [section.title ?? '', item.label];
        const child = item.children?.find((c) => matches(c.route));
        if (child) return [section.title ?? '', item.label, child.label];
      }
    }
    return path.startsWith('/profile') ? ['My Profile'] : [];
  });

  pickDate(event: Event): void {
    this.ui.setViewDate((event.target as HTMLInputElement).value || null);
  }
}
