import { Injectable, computed, inject } from '@angular/core';
import { ProfileMenuItem, UserProfile } from '../models/user.model';
import { AuthService } from './auth.service';

const SIGNED_OUT: UserProfile = { name: '', email: '', role: '', initials: '' };

/** The signed-in user's profile, derived from the ACS access token. Edited in ACS, not here. */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly auth = inject(AuthService);

  readonly profile = computed<UserProfile>(() => {
    const s = this.auth.session();
    return s
      ? { name: s.name, email: s.email, role: s.role ?? '', initials: s.initials }
      : SIGNED_OUT;
  });

  readonly menuItems: ProfileMenuItem[] = [
    { id: 'profile', label: 'My Profile', icon: 'user', route: '/profile' },
    { id: 'theme', label: 'Toggle theme', icon: 'moon', action: 'toggle-theme' },
    { id: 'sign-out', label: 'Sign out', icon: 'x', action: 'sign-out', danger: true },
  ];
}
