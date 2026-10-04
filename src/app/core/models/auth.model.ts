/** The signed-in user, derived from the ACS access token (display only; the API verifies it). */
export interface SessionUser {
  /** ACS user id (claim `userId`). */
  id: string;
  /** ACS org_user_name (claim `sub`). */
  username: string;
  name: string;
  email: string;
  /** Display title derived from the roles, e.g. "Treasury Dealer". */
  role: string;
  initials: string;
  /** MM Blotter API role ids, e.g. `MMB_DEAL_RD`. */
  roles: string[];
  /** Same as `roles`: `hasPermission()` checks take ACS API role ids. */
  permissions: string[];
}

/** ACS /oauth2/token response. */
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface Credentials {
  /** ACS username (org_user_name). */
  username: string;
  password: string;
}

/** A tenant's password rules as ACS sends them (`password_policy`, snake_case on the wire). */
export interface PasswordPolicy {
  minLength: number;
  /** BCrypt limit: ACS rejects passwords longer than this many UTF-8 bytes. */
  maxBytes: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecial: boolean;
  /** How many previous passwords can't be reused (0 = only the current one). */
  historyDepth: number;
  /** Days a password stays valid (0 = never expires). */
  expiryDays: number;
}

/** What the UI does with an ACS error from `/oauth2/*`. */
export type AcsErrorKind =
  /** 403: right credentials, a TOTP code (and maybe enrolment) is still needed. */
  | 'mfa_required'
  /** 403: right credentials, but the password must be changed first. */
  | 'password_expired'
  /** 401: wrong, malformed or already used TOTP code. */
  | 'invalid_totp'
  /** 401: the MFA sign-in step expired or was used up; sign in again. */
  | 'invalid_mfa_token'
  /** 400/401 without a more specific code (ACS never says which part was wrong). */
  | 'invalid_credentials'
  /** 400: the new password breaks the policy (`password_policy_violation` / `password_reused`). */
  | 'password_policy'
  | 'invalid_request'
  | 'rate_limited'
  | 'network'
  | 'unknown';

export interface AcsError {
  kind: AcsErrorKind;
  /** ACS `error` code as sent, e.g. `password_reused`. */
  code: string | null;
  status: number;
  /** User-facing message. */
  message: string;
  /** The current sign-in attempt is dead: go back to the credentials step. */
  restart: boolean;
  mfaToken?: string;
  enrolled?: boolean;
  /** Seconds the MFA step stays valid. */
  expiresIn?: number;
  attemptsRemaining?: number;
  violations?: string[];
  policy?: PasswordPolicy;
}

export type LoginOutcome =
  | { kind: 'ok' }
  /** A TOTP step is needed; `enrolled: false` means set up an authenticator app first. */
  | { kind: 'mfa'; enrolled: boolean; expiresIn: number | null }
  | { kind: 'expired'; policy: PasswordPolicy | null; message: string }
  | { kind: 'error'; error: AcsError };

/** ACS POST /oauth2/mfa/enroll response. */
export interface MfaEnrolment {
  secret: string;
  otpauthUri: string;
  /** PNG data URI; null when ACS couldn't render the QR image (the secret still works). */
  qrCodeDataUri: string | null;
  issuer: string;
  accountName: string;
  expiresIn: number;
}

export type MfaEnrolmentOutcome =
  { kind: 'ok'; enrolment: MfaEnrolment } | { kind: 'error'; error: AcsError };

export interface PasswordChange {
  username: string;
  currentPassword: string;
  newPassword: string;
  /** Needed only when the tenant enforces MFA and the user is enrolled. */
  totpCode?: string;
}
