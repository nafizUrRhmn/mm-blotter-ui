import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
import { ThemeService } from '../../../core/services/theme.service';
import { AuthService } from '../../../core/services/auth.service';
import { NavConfigService } from '../../../core/services/nav-config.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ProfileMenuItem } from '../../../core/models/user.model';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-profile-menu',
  standalone: true,
  imports: [CommonModule, Icon],
  templateUrl: './profile-menu.html',
  styleUrl: './profile-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileMenu {
  private readonly userService = inject(UserService);
  private readonly theme = inject(ThemeService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly nav = inject(NavConfigService);
  private readonly notifications = inject(NotificationService);

  readonly profile = this.userService.profile;
  readonly menuItems = this.userService.menuItems;
  readonly open = signal(false);

  toggle(): void {
    this.open.update((v) => !v);
  }

  select(item: ProfileMenuItem): void {
    if (item.action === 'toggle-theme') {
      this.theme.toggle();
    }
    if (item.action === 'sign-out') {
      this.open.set(false);
      void this.signOut();
      return;
    }
    if (item.route) {
      this.router.navigateByUrl(item.route);
    }
    this.open.set(false);
  }

  private async signOut(): Promise<void> {
    await this.authService.logout();
    this.nav.reset();
    this.notifications.reset();
    this.router.navigateByUrl('/login');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }
}
