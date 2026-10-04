import { HttpContextToken } from '@angular/common/http';
import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Base URL of the MM Blotter API: `environment.apiUrl` (the service's context path `/mmb`) +
 * `/api/v1`. In dev that is the absolute `http://localhost:8087/mmb` (CORS allows :4201); the
 * production build uses the relative `/mmb` behind the same reverse proxy as the SPA.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => `${environment.apiUrl}/api/v1`,
});

/** Set on a request to handle its errors locally instead of showing the global toast. */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

/** Extracts the user-facing message from an RFC 9457 problem+json error. */
export function problemMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const body = (error as { error?: { detail?: string; errors?: { field: string; message: string }[] } })?.error;
  if (body?.errors?.length) {
    return body.errors.map((e) => `${e.field}: ${e.message}`).join('; ');
  }
  return body?.detail ?? fallback;
}
