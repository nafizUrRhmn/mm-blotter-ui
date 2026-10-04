import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SessionUser } from '../models/auth.model';
import { AuthService } from '../services/auth.service';
import { NavConfigService } from '../services/nav-config.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  return router.createUrlTree(['/login'], { queryParams: { redirectTo: state.url } });
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) return true;

  return router.createUrlTree(['/']);
};

/** The session user; renews the access token first when only a refresh token is left. */
async function currentUser(auth: AuthService): Promise<SessionUser | null> {
  if (auth.session()) return auth.session();
  if (!auth.isAuthenticated()) return null;
  await firstValueFrom(auth.refresh());
  return auth.session();
}

/**
 * Menu-based access: a page is reachable only if it appears in the user's ACS menu (after role
 * filtering). Denied deep links land on the user's home page instead of an error.
 * (The API enforces the same roles independently — this is UX, not the security boundary.)
 */
export const menuAccessGuard: CanActivateChildFn = async (_route, state) => {
  const auth = inject(AuthService);
  const nav = inject(NavConfigService);
  const router = inject(Router);

  const user = await currentUser(auth);
  if (!user) return router.createUrlTree(['/login'], { queryParams: { redirectTo: state.url } });

  await nav.load(user.username);
  if (state.url === '/' || nav.canAccess(state.url)) return true;
  return router.createUrlTree([nav.homeRoute()]);
};

/** Resolves the empty path to the user's permitted landing page. */
export const homeRedirectGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const nav = inject(NavConfigService);
  const router = inject(Router);
  const user = await currentUser(auth);
  if (!user) return router.createUrlTree(['/login']);
  await nav.load(user.username);
  return router.createUrlTree([nav.homeRoute()]);
};
