import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../core/services/user.service';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';
import { NavConfigService } from '../../core/services/nav-config.service';
import { Icon } from '../../shared/components/icon/icon';
import { PageHeader } from '../../shared/components/page-header/page-header';

/**
 * Read-only profile: who the ACS token says the user is. Name, e-mail, password and roles are
 * managed in ACS (MM Blotter is the ACS tenant MM-BLOTTER).
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, Icon, PageHeader],
  templateUrl: './profile.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile {
  private readonly userService = inject(UserService);
  private readonly auth = inject(AuthService);
  private readonly nav = inject(NavConfigService);
  readonly theme = inject(ThemeService);

  readonly profile = this.userService.profile;
  readonly session = this.auth.session;
  readonly sections = this.nav.sections;
}
