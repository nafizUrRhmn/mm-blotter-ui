import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { API_BASE_URL, SKIP_ERROR_TOAST, problemMessage } from './api.config';

/** ACS endpoints that take the user's bearer token (e.g. `GET /me/menus`). */
const ACS_API = `${environment.acsUrl}/api/v1/acs/`;

/**
 * - Attaches the ACS access token to MM Blotter API calls and to ACS's authenticated API
 *   (`/api/v1/acs/...`), never to the OAuth2 handshake (`/oauth2/...`) or ACS `public/` endpoints.
 * - On 401, performs one silent refresh (shared with any concurrent 401s, see `AuthService.refresh`)
 *   and replays the request; if that fails the user is sent to the sign-in page.
 * - Surfaces other MM Blotter API failures as a toast unless the caller opted out via SKIP_ERROR_TOAST.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(API_BASE_URL);
  const isApi = req.url.startsWith(api);
  const isAcsApi = req.url.startsWith(ACS_API) && !req.url.startsWith(`${ACS_API}public/`);
  if ((!isApi && !isAcsApi) || req.url.includes('/oauth2/')) {
    return next(req);
  }

  const auth = inject(AuthService);
  const router = inject(Router);
  const toasts = inject(ToastService);
  const withToken = (token: string | null) =>
    token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(withToken(auth.token())).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        return auth.refresh().pipe(
          switchMap((token) => {
            if (!token) {
              router.navigate(['/login'], { queryParams: { redirectTo: router.url } });
              return throwError(() => err);
            }
            return next(withToken(token));
          }),
        );
      }
      return throwError(() => err);
    }),
    catchError((err: unknown) => {
      const status = err instanceof HttpErrorResponse ? err.status : 0;
      if (isApi && status !== 401 && !req.context.get(SKIP_ERROR_TOAST)) {
        toasts.error(
          status === 0 ? 'Cannot reach the server. Check your connection.' : problemMessage(err),
        );
      }
      return throwError(() => err);
    }),
  );
};
