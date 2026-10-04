import { HttpClient, HttpContext, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, firstValueFrom, map, of, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST, problemMessage } from '../api/api.config';
import { ApiRoles } from '../auth/api-roles';
import {
  AcsError,
  Credentials,
  LoginOutcome,
  MfaEnrolmentOutcome,
  PasswordChange,
  PasswordPolicy,
  SessionUser,
  TokenResponse,
} from '../models/auth.model';
import { createCodeChallenge, createCodeVerifier } from './pkce';

const ACCESS_TOKEN_KEY = 'mmb.accessToken';
const REFRESH_TOKEN_KEY = 'mmb.refreshToken';

/**
 * Session management against ACS (Access Control Service). MM Blotter is the ACS tenant
 * `MM-BLOTTER`; users, passwords and roles live in ACS.
 *
 * - Login uses ACS's headless authorization_code + PKCE flow, so no client secret ships in the
 *   browser: `POST /oauth2/authorize` (username + password + code_challenge) returns a code, then
 *   `POST /oauth2/token` (code + code_verifier) returns the access and refresh tokens. authorize and
 *   token read their parameters from the query string only.
 * - When the tenant enforces MFA, authorize answers 403 `mfa_required` with an `mfa_token`; the
 *   sign-in stays pending (same PKCE verifier) through `POST /oauth2/mfa/enroll` (first time) and
 *   `POST /oauth2/mfa/verify`, which returns the code. An expired password is 403
 *   `password_expired`, fixed with `POST /oauth2/password`. These three take JSON bodies.
 * - Tokens are kept in localStorage (`mmb.*`) and followed across tabs via the `storage` event.
 * - The session (user, roles) is decoded from the access token for display only; the API verifies
 *   the signature and enforces the roles.
 * - ACS rotates refresh tokens and treats reuse as theft (it ends the session), so concurrent 401s
 *   share one in-flight refresh (see `refresh()`). Do not add a second refresh path.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly oauthUrl = `${environment.acsUrl}/oauth2`;

  private readonly accessToken = signal<string | null>(readStorage(ACCESS_TOKEN_KEY));
  private readonly refreshToken = signal<string | null>(readStorage(REFRESH_TOKEN_KEY));
  private refreshInFlight$: Observable<string | null> | null = null;
  /** The sign-in waiting for its MFA step: PKCE verifier + ACS's opaque, single-use mfa_token. */
  private pending: { verifier: string; mfaToken: string } | null = null;

  readonly session = computed<SessionUser | null>(() => {
    const token = this.accessToken();
    return token ? sessionFromToken(token) : null;
  });

  /** Signed in while a refresh token is held: an expired access token is renewed on the next 401. */
  readonly isAuthenticated = computed(() => !!this.refreshToken() || !!this.session());
  readonly permissions = computed(() => new Set(this.session()?.permissions ?? []));

  constructor() {
    // Keep this tab in step with token rotation / logout done in another tab.
    window.addEventListener('storage', (event) => {
      if (event.key === ACCESS_TOKEN_KEY) this.accessToken.set(event.newValue);
      if (event.key === REFRESH_TOKEN_KEY) this.refreshToken.set(event.newValue);
      if (event.key === null) {
        this.accessToken.set(readStorage(ACCESS_TOKEN_KEY));
        this.refreshToken.set(readStorage(REFRESH_TOKEN_KEY));
      }
    });
  }

  /** `code` is an ACS API role id (see `ApiRoles`). */
  hasPermission(code: string): boolean {
    return this.permissions().has(code);
  }

  hasAnyPermission(codes: string[]): boolean {
    const granted = this.permissions();
    return codes.some((c) => granted.has(c));
  }

  /** Current bearer token, or null when signed out. */
  token(): string | null {
    return this.accessToken();
  }

  /**
   * Step 1 of sign-in: `POST /oauth2/authorize`. When ACS answers `mfa_required` the PKCE verifier
   * and the `mfa_token` stay pending for `startMfaEnrolment()` / `completeMfa()`. `totpCode` lets an
   * enrolled user send the code in the same request.
   */
  async login(credentials: Credentials, totpCode?: string): Promise<LoginOutcome> {
    this.pending = null;
    const verifier = createCodeVerifier();
    try {
      const challenge = await createCodeChallenge(verifier);
      const params: Record<string, string> = {
        client_id: environment.clientId,
        response_type: 'code',
        redirect_uri: environment.redirectUri,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        username: credentials.username.trim(),
        password: credentials.password,
      };
      if (totpCode?.trim()) params['totp_code'] = totpCode.trim();
      const { code } = await firstValueFrom(
        this.http.post<{ code: string }>(`${this.oauthUrl}/authorize`, null, {
          params: new HttpParams({ fromObject: params }),
          context: quiet(),
        }),
      );
      await this.exchangeCode(code, verifier);
      return { kind: 'ok' };
    } catch (err) {
      const error = classifyAcsError(err);
      if (error.kind === 'mfa_required' && error.mfaToken) {
        this.pending = { verifier, mfaToken: error.mfaToken };
        return { kind: 'mfa', enrolled: !!error.enrolled, expiresIn: error.expiresIn ?? null };
      }
      if (error.kind === 'password_expired') {
        return { kind: 'expired', policy: error.policy ?? null, message: error.message };
      }
      return { kind: 'error', error };
    }
  }

  /** First-time MFA set-up for the pending sign-in: a new TOTP secret, otpauth URI and QR image. */
  async startMfaEnrolment(): Promise<MfaEnrolmentOutcome> {
    const pending = this.pending;
    if (!pending) return { kind: 'error', error: MFA_STEP_LOST };
    try {
      const res = await firstValueFrom(
        this.http.post<MfaEnrolmentResponse>(
          `${this.oauthUrl}/mfa/enroll`,
          { client_id: environment.clientId, mfa_token: pending.mfaToken },
          { context: quiet() },
        ),
      );
      return {
        kind: 'ok',
        enrolment: {
          secret: res.secret,
          otpauthUri: res.otpauth_uri,
          qrCodeDataUri: res.qr_code_data_uri || null,
          issuer: res.issuer,
          accountName: res.account_name,
          expiresIn: res.expires_in,
        },
      };
    } catch (err) {
      return { kind: 'error', error: this.failPending(err) };
    }
  }

  /**
   * Finishes the pending sign-in with a TOTP code (`POST /oauth2/mfa/verify`, which also saves a
   * first-time enrolment), then exchanges the returned code with the pending PKCE verifier.
   */
  async completeMfa(totpCode: string): Promise<LoginOutcome> {
    const pending = this.pending;
    if (!pending) return { kind: 'error', error: MFA_STEP_LOST };
    let code: string;
    try {
      ({ code } = await firstValueFrom(
        this.http.post<{ code: string }>(
          `${this.oauthUrl}/mfa/verify`,
          {
            client_id: environment.clientId,
            mfa_token: pending.mfaToken,
            totp_code: totpCode.trim(),
          },
          { context: quiet() },
        ),
      ));
    } catch (err) {
      return { kind: 'error', error: this.failPending(err) };
    }
    // The mfa_token is spent now; whatever happens next, a retry starts from the password.
    this.pending = null;
    try {
      await this.exchangeCode(code, pending.verifier);
      return { kind: 'ok' };
    } catch (err) {
      return { kind: 'error', error: { ...classifyAcsError(err), restart: true } };
    }
  }

  /** Forgets a half-finished sign-in (the MFA step). */
  cancelLogin(): void {
    this.pending = null;
  }

  /**
   * Self-service password change (`POST /oauth2/password`, JSON), authenticated by the current
   * password (+ `totpCode` when the tenant enforces MFA and the user is enrolled). Works when the
   * password has expired. ACS ends all of the user's sessions. Resolves to null on success.
   */
  async changePassword(change: PasswordChange): Promise<AcsError | null> {
    const body: Record<string, string> = {
      client_id: environment.clientId,
      username: change.username.trim(),
      currentPassword: change.currentPassword,
      newPassword: change.newPassword,
    };
    if (change.totpCode?.trim()) body['totp_code'] = change.totpCode.trim();
    try {
      await firstValueFrom(
        this.http.post<void>(`${this.oauthUrl}/password`, body, { context: quiet() }),
      );
      return null;
    } catch (err) {
      return classifyAcsError(err);
    }
  }

  /** Exchanges the refresh token for new tokens. Emits the access token, or null if the session is gone. */
  refresh(): Observable<string | null> {
    if (!this.refreshInFlight$) {
      // Read storage rather than memory: another tab may have rotated the token since this one loaded.
      const refreshToken = readStorage(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        this.clearSession();
        return of(null);
      }
      this.refreshInFlight$ = this.tokenRequest({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: environment.clientId,
      }).pipe(
        map((res) => {
          this.storeTokens(res);
          return res.access_token;
        }),
        catchError(() => {
          this.clearSession();
          return of(null);
        }),
        finalize(() => (this.refreshInFlight$ = null)),
        shareReplay(1),
      );
    }
    return this.refreshInFlight$;
  }

  /** ACS has no tenant logout endpoint, so this forgets the tokens locally. */
  async logout(): Promise<void> {
    this.clearSession();
  }

  clearSession(): void {
    this.accessToken.set(null);
    this.refreshToken.set(null);
    removeStorage(ACCESS_TOKEN_KEY);
    removeStorage(REFRESH_TOKEN_KEY);
  }

  private async exchangeCode(code: string, verifier: string): Promise<void> {
    const res = await firstValueFrom(
      this.tokenRequest({
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        client_id: environment.clientId,
        redirect_uri: environment.redirectUri,
      }),
    );
    this.storeTokens(res);
  }

  /** Classifies an MFA-step failure and drops the pending sign-in when ACS says it is dead. */
  private failPending(err: unknown): AcsError {
    const error = classifyAcsError(err);
    if (error.restart) this.pending = null;
    return error;
  }

  private tokenRequest(params: Record<string, string>): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.oauthUrl}/token`, null, {
      params: new HttpParams({ fromObject: params }),
      context: quiet(),
    });
  }

  private storeTokens(res: TokenResponse): void {
    this.accessToken.set(res.access_token);
    writeStorage(ACCESS_TOKEN_KEY, res.access_token);
    if (res.refresh_token) {
      this.refreshToken.set(res.refresh_token);
      writeStorage(REFRESH_TOKEN_KEY, res.refresh_token);
    }
  }
}

const MFA_STEP_LOST: AcsError = {
  kind: 'invalid_mfa_token',
  code: null,
  status: 0,
  message: 'This sign-in step has expired. Sign in again.',
  restart: true,
};

interface MfaEnrolmentResponse {
  secret: string;
  otpauth_uri: string;
  qr_code_data_uri: string | null;
  issuer: string;
  account_name: string;
  expires_in: number;
}

/**
 * Maps an `/oauth2/*` failure to what the UI shows. ACS sends `application/problem+json` with an
 * OAuth2-style `error` code for the sign-in, MFA and password-change outcomes; plain 400/401s
 * (unknown client, wrong password, bad code exchange) carry no code and read as bad credentials.
 */
export function classifyAcsError(err: unknown): AcsError {
  const status = err instanceof HttpErrorResponse ? err.status : -1;
  const body: Record<string, unknown> =
    err instanceof HttpErrorResponse && err.error && typeof err.error === 'object' ? err.error : {};
  const code = typeof body['error'] === 'string' ? body['error'] : null;
  const description =
    stringClaim(body, 'error_description') ?? stringClaim(body, 'detail') ?? undefined;
  const base = { code, status, restart: false };

  if (status === 0) {
    return {
      ...base,
      kind: 'network',
      message: 'Cannot reach the sign-in service. Check your connection.',
    };
  }
  switch (code) {
    case 'mfa_required':
      return {
        ...base,
        kind: 'mfa_required',
        message: description ?? 'Enter the 6-digit code from your authenticator app.',
        mfaToken: stringClaim(body, 'mfa_token') ?? undefined,
        enrolled: body['enrolled'] === true,
        expiresIn: numberField(body, 'expires_in'),
      };
    case 'password_expired':
      return {
        ...base,
        kind: 'password_expired',
        message: 'Your password has expired. Choose a new one to continue.',
        policy: parsePasswordPolicy(body['password_policy']),
      };
    case 'invalid_totp': {
      const attemptsRemaining = numberField(body, 'attempts_remaining');
      if (attemptsRemaining === 0) {
        return {
          ...base,
          kind: 'invalid_totp',
          restart: true,
          attemptsRemaining,
          message: 'Too many incorrect codes. Sign in again.',
        };
      }
      const left =
        attemptsRemaining === undefined
          ? ''
          : ` ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} left.`;
      return {
        ...base,
        kind: 'invalid_totp',
        attemptsRemaining,
        message: `That code is incorrect or has expired. Enter the current code from your authenticator app.${left}`,
      };
    }
    case 'invalid_mfa_token':
      return {
        ...base,
        kind: 'invalid_mfa_token',
        restart: true,
        message: 'This sign-in step expired or was already used. Sign in again.',
      };
    case 'password_policy_violation':
    case 'password_reused': {
      const violations = Array.isArray(body['violations'])
        ? body['violations'].filter((v): v is string => typeof v === 'string')
        : [];
      return {
        ...base,
        kind: 'password_policy',
        violations: violations.length ? violations : description ? [description] : [],
        policy: parsePasswordPolicy(body['password_policy']),
        message:
          code === 'password_reused'
            ? (description ?? 'Choose a password you have not used recently.')
            : 'The new password does not meet the password rules.',
      };
    }
    case 'invalid_request':
      return { ...base, kind: 'invalid_request', message: description ?? 'Invalid request.' };
    case 'invalid_grant':
      return { ...base, kind: 'invalid_credentials', message: 'Invalid username or password.' };
  }
  if (status === 400 || status === 401) {
    return { ...base, kind: 'invalid_credentials', message: 'Invalid username or password.' };
  }
  if (status === 429) {
    return {
      ...base,
      kind: 'rate_limited',
      message: 'Too many attempts. Wait a minute and try again.',
    };
  }
  return {
    ...base,
    kind: 'unknown',
    message: problemMessage(err, 'Unable to sign in. Please try again.'),
  };
}

/** Reads ACS's snake_case `password_policy` hint; undefined when absent or malformed. */
export function parsePasswordPolicy(wire: unknown): PasswordPolicy | undefined {
  if (!wire || typeof wire !== 'object') return undefined;
  const w = wire as Record<string, unknown>;
  const minLength = numberField(w, 'min_length');
  if (minLength === undefined) return undefined;
  return {
    minLength,
    maxBytes: numberField(w, 'max_bytes') ?? 72,
    requireUppercase: w['require_uppercase'] === true,
    requireLowercase: w['require_lowercase'] === true,
    requireDigit: w['require_digit'] === true,
    requireSpecial: w['require_special'] === true,
    historyDepth: numberField(w, 'history_depth') ?? 0,
    expiryDays: numberField(w, 'expiry_days') ?? 0,
  };
}

export interface PasswordCheck {
  label: string;
  /** null = can't be checked in the browser (ACS decides). */
  ok: boolean | null;
}

/**
 * The policy as a checklist for the change-password form, evaluated against `password`. Mirrors
 * ACS's rules (Unicode classes; special = not a letter, digit or whitespace; never the username).
 */
export function passwordChecks(
  policy: PasswordPolicy,
  password: string,
  username: string,
): PasswordCheck[] {
  const bytes = new TextEncoder().encode(password).length;
  const checks: PasswordCheck[] = [
    {
      label: `${policy.minLength} to ${policy.maxBytes} characters`,
      ok: [...password].length >= policy.minLength && bytes <= policy.maxBytes,
    },
  ];
  if (policy.requireUppercase)
    checks.push({ label: 'An uppercase letter', ok: /\p{Lu}/u.test(password) });
  if (policy.requireLowercase)
    checks.push({ label: 'A lowercase letter', ok: /\p{Ll}/u.test(password) });
  if (policy.requireDigit) checks.push({ label: 'A digit', ok: /\p{Nd}/u.test(password) });
  if (policy.requireSpecial) {
    checks.push({ label: 'A symbol (e.g. ! @ # $)', ok: /[^\p{L}\p{Nd}\s]/u.test(password) });
  }
  const name = username.trim().toLowerCase();
  if (name.length >= 3) {
    checks.push({
      label: 'Does not contain your username',
      ok: !password.toLowerCase().includes(name),
    });
  }
  checks.push({
    label:
      policy.historyDepth > 0
        ? `Not your current password or one of your last ${policy.historyDepth}`
        : 'Not your current password',
    ok: null,
  });
  return checks;
}

function numberField(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** Display-only decode - the backend is what verifies the signature. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=')));
  } catch {
    return null;
  }
}

/** Builds the session from ACS access-token claims (`sub`, `username`, `email`, `userId`, `roles`). */
export function sessionFromToken(token: string): SessionUser | null {
  const claims = decodeJwtPayload(token);
  const username = typeof claims?.['sub'] === 'string' ? claims['sub'] : null;
  if (!claims || !username) return null;
  const rolesClaim = Array.isArray(claims['roles']) ? (claims['roles'] as unknown[]) : [];
  const roles = rolesClaim
    .filter((r): r is string => typeof r === 'string' && r.startsWith('ROLE_MMB_'))
    .map((r) => r.substring('ROLE_'.length));
  const name = stringClaim(claims, 'name') ?? stringClaim(claims, 'username') ?? username;
  return {
    id: stringClaim(claims, 'userId') ?? username,
    username,
    name,
    email: stringClaim(claims, 'email') ?? '',
    role: roleLabel(roles),
    initials: initials(name),
    roles,
    permissions: roles,
  };
}

function roleLabel(roles: string[]): string {
  if (roles.includes(ApiRoles.FORECAST_CREATE)) return 'Treasury Dealer';
  if (roles.includes(ApiRoles.ROC_WRITE)) return 'Treasury Back Office';
  if (roles.includes(ApiRoles.FORECAST_APPROVE)) return 'Mid Office';
  return roles.length ? 'Treasury Viewer' : 'No MM Blotter access';
}

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || '?'
  ).substring(0, 2);
}

function stringClaim(claims: Record<string, unknown>, key: string): string | null {
  const v = claims[key];
  return typeof v === 'string' && v.trim() ? v : null;
}

function quiet(): HttpContext {
  return new HttpContext().set(SKIP_ERROR_TOAST, true);
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the session lasts for this page only */
  }
}

function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
