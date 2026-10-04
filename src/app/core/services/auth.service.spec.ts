import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AuthService, classifyAcsError, passwordChecks, sessionFromToken } from './auth.service';
import { createCodeChallenge } from './pkce';

function token(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'RS256' })}.${b64(claims)}.sig`;
}

describe('sessionFromToken', () => {
  it('reads the ACS claims and keeps only MM Blotter roles', () => {
    const s = sessionFromToken(
      token({
        sub: 'polash',
        username: 'polash',
        email: 'polash@bracbank.com',
        userId: 'polash',
        roles: ['ROLE_MMB_DEAL_RD', 'ROLE_MMB_FORECAST_CTRL', 'ROLE_USR_RD'],
      }),
    );
    expect(s?.username).toBe('polash');
    expect(s?.email).toBe('polash@bracbank.com');
    expect(s?.roles).toEqual(['MMB_DEAL_RD', 'MMB_FORECAST_CTRL']);
    expect(s?.permissions).toEqual(s?.roles);
    expect(s?.role).toBe('Treasury Dealer');
    expect(s?.initials).toBe('P');
  });

  it('returns null for a malformed token', () => {
    expect(sessionFromToken('not-a-jwt')).toBeNull();
  });
});

const POLICY_WIRE = {
  min_length: 10,
  max_bytes: 72,
  require_uppercase: true,
  require_lowercase: true,
  require_digit: true,
  require_special: false,
  history_depth: 5,
  expiry_days: 90,
};

/** An ACS SecurityFlowException body (problem+json with the OAuth2-style `error`). */
function acs(status: number, error: string | null, extras: Record<string, unknown> = {}) {
  const body: Record<string, unknown> = {
    type: 'about:blank',
    status,
    detail: `detail of ${error}`,
    ...extras,
  };
  if (error) {
    body['error'] = error;
    body['error_description'] = `description of ${error}`;
  }
  return new HttpErrorResponse({ status, error: body, url: 'http://acs/oauth2/x' });
}

describe('classifyAcsError', () => {
  it('reads mfa_required with its mfa_token, enrolled and expires_in', () => {
    const e = classifyAcsError(
      acs(403, 'mfa_required', { mfa_token: 'tok', enrolled: false, expires_in: 300 }),
    );
    expect(e).toMatchObject({
      kind: 'mfa_required',
      code: 'mfa_required',
      status: 403,
      mfaToken: 'tok',
      enrolled: false,
      expiresIn: 300,
      restart: false,
    });
  });

  it('reads mfa_required without a token (password change needs a code)', () => {
    const e = classifyAcsError(acs(403, 'mfa_required', { enrolled: true }));
    expect(e.kind).toBe('mfa_required');
    expect(e.mfaToken).toBeUndefined();
    expect(e.enrolled).toBe(true);
  });

  it('reads password_expired and converts the snake_case policy', () => {
    const e = classifyAcsError(acs(403, 'password_expired', { password_policy: POLICY_WIRE }));
    expect(e.kind).toBe('password_expired');
    expect(e.message).toMatch(/expired/);
    expect(e.policy).toEqual({
      minLength: 10,
      maxBytes: 72,
      requireUppercase: true,
      requireLowercase: true,
      requireDigit: true,
      requireSpecial: false,
      historyDepth: 5,
      expiryDays: 90,
    });
  });

  it('reports the attempts left on invalid_totp', () => {
    const e = classifyAcsError(acs(401, 'invalid_totp', { attempts_remaining: 2 }));
    expect(e.kind).toBe('invalid_totp');
    expect(e.attemptsRemaining).toBe(2);
    expect(e.message).toContain('2 attempts left');
    expect(e.restart).toBe(false);
    expect(classifyAcsError(acs(401, 'invalid_totp', { attempts_remaining: 1 })).message).toContain(
      '1 attempt left',
    );
  });

  it('treats invalid_totp with no attempts left as a restart', () => {
    const e = classifyAcsError(acs(401, 'invalid_totp', { attempts_remaining: 0 }));
    expect(e.restart).toBe(true);
    expect(e.message).toMatch(/Sign in again/);
  });

  it('omits the count when ACS sends none (authorize / password change)', () => {
    const e = classifyAcsError(acs(401, 'invalid_totp'));
    expect(e.attemptsRemaining).toBeUndefined();
    expect(e.message).not.toMatch(/attempt/);
  });

  it('treats invalid_mfa_token as a restart', () => {
    const e = classifyAcsError(acs(401, 'invalid_mfa_token'));
    expect(e).toMatchObject({ kind: 'invalid_mfa_token', restart: true });
    expect(e.message).toMatch(/Sign in again/);
  });

  it('collects the violations of password_policy_violation and password_reused', () => {
    const v = classifyAcsError(
      acs(400, 'password_policy_violation', {
        violations: ['Too short', 'Needs a digit'],
        password_policy: POLICY_WIRE,
      }),
    );
    expect(v).toMatchObject({
      kind: 'password_policy',
      violations: ['Too short', 'Needs a digit'],
    });
    expect(v.policy?.minLength).toBe(10);

    const r = classifyAcsError(
      acs(400, 'password_reused', { violations: ['Used before'], password_policy: POLICY_WIRE }),
    );
    expect(r).toMatchObject({ kind: 'password_policy', code: 'password_reused' });
    expect(r.message).toBe('description of password_reused');
  });

  it('reads invalid_grant and plain 400/401 problems as bad credentials', () => {
    expect(classifyAcsError(acs(401, 'invalid_grant')).kind).toBe('invalid_credentials');
    const plain = classifyAcsError(acs(401, null));
    expect(plain.kind).toBe('invalid_credentials');
    expect(plain.message).toBe('Invalid username or password.');
    expect(classifyAcsError(acs(400, null)).kind).toBe('invalid_credentials');
  });

  it('shows invalid_request, rate limits, network and other failures', () => {
    expect(classifyAcsError(acs(400, 'invalid_request'))).toMatchObject({
      kind: 'invalid_request',
      message: 'description of invalid_request',
    });
    expect(classifyAcsError(new HttpErrorResponse({ status: 429 })).kind).toBe('rate_limited');
    expect(classifyAcsError(new HttpErrorResponse({ status: 0 })).kind).toBe('network');
    const server = classifyAcsError(acs(500, null));
    expect(server).toMatchObject({ kind: 'unknown', message: 'detail of null' });
    expect(classifyAcsError(new Error('boom')).kind).toBe('unknown');
  });
});

describe('passwordChecks', () => {
  const policy = classifyAcsError(
    acs(403, 'password_expired', { password_policy: POLICY_WIRE }),
  ).policy!;

  it('ticks the rules the new password meets', () => {
    const ok = (pw: string) =>
      Object.fromEntries(passwordChecks(policy, pw, 'polash').map((c) => [c.label, c.ok]));
    expect(ok('Short1')).toMatchObject({
      '10 to 72 characters': false,
      'An uppercase letter': true,
      'A digit': true,
    });
    expect(ok('lowercase-only-long')).toMatchObject({
      'An uppercase letter': false,
      'A lowercase letter': true,
    });
    expect(ok('MyPolashPass1')['Does not contain your username']).toBe(false);
    expect(ok('Ünïcode-Pässwörd9')['An uppercase letter']).toBe(true);
    // Not checkable in the browser: ACS compares against the history.
    expect(ok('x')['Not your current password or one of your last 5']).toBeNull();
    expect(Object.keys(ok('x'))).not.toContain('A symbol (e.g. ! @ # $)');
  });
});

describe('AuthService MFA sign-in', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  const oauth = `${environment.acsUrl}/oauth2`;
  const flush = () => new Promise((r) => setTimeout(r, 0));

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('keeps the PKCE verifier across mfa_required → enroll → verify → token', async () => {
    const login = auth.login({ username: ' polash ', password: 'secret' });
    await flush();
    const authorize = http.expectOne((r) => r.url === `${oauth}/authorize`);
    expect(authorize.request.params.get('username')).toBe('polash');
    expect(authorize.request.params.has('totp_code')).toBe(false);
    const challenge = authorize.request.params.get('code_challenge')!;
    authorize.flush(
      { error: 'mfa_required', mfa_token: 'tok', enrolled: false, expires_in: 300 },
      { status: 403, statusText: 'Forbidden' },
    );
    expect(await login).toEqual({ kind: 'mfa', enrolled: false, expiresIn: 300 });

    const enrol = auth.startMfaEnrolment();
    const enrollReq = http.expectOne(`${oauth}/mfa/enroll`);
    expect(enrollReq.request.body).toEqual({ client_id: environment.clientId, mfa_token: 'tok' });
    enrollReq.flush({
      secret: 'ABCDEFGH',
      otpauth_uri: 'otpauth://totp/x',
      qr_code_data_uri: null,
      issuer: 'MM Blotter',
      account_name: 'polash',
      expires_in: 290,
    });
    expect(await enrol).toMatchObject({
      kind: 'ok',
      enrolment: { secret: 'ABCDEFGH', qrCodeDataUri: null, accountName: 'polash' },
    });

    const done = auth.completeMfa(' 123456 ');
    const verify = http.expectOne(`${oauth}/mfa/verify`);
    expect(verify.request.body).toEqual({
      client_id: environment.clientId,
      mfa_token: 'tok',
      totp_code: '123456',
    });
    verify.flush({ code: 'the-code', redirect_uri: environment.redirectUri });
    await flush();
    const token = http.expectOne((r) => r.url === `${oauth}/token`);
    expect(token.request.params.get('code')).toBe('the-code');
    expect(await createCodeChallenge(token.request.params.get('code_verifier')!)).toBe(challenge);
    token.flush({ access_token: 'a', refresh_token: 'r', token_type: 'Bearer', expires_in: 600 });
    expect(await done).toEqual({ kind: 'ok' });
    expect(localStorage.getItem('mmb.refreshToken')).toBe('r');
  });

  it('drops the pending sign-in when the mfa_token is dead', async () => {
    const login = auth.login({ username: 'polash', password: 'secret' });
    await flush();
    http
      .expectOne((r) => r.url === `${oauth}/authorize`)
      .flush(
        { error: 'mfa_required', mfa_token: 'tok', enrolled: true },
        { status: 403, statusText: 'Forbidden' },
      );
    await login;

    const first = auth.completeMfa('111111');
    http
      .expectOne(`${oauth}/mfa/verify`)
      .flush({ error: 'invalid_mfa_token' }, { status: 401, statusText: 'Unauthorized' });
    expect(await first).toMatchObject({ kind: 'error', error: { restart: true } });

    // Nothing pending any more: no request is sent.
    expect(await auth.completeMfa('222222')).toMatchObject({
      kind: 'error',
      error: { kind: 'invalid_mfa_token' },
    });
  });

  it('returns expired with the policy, and sends the password change as JSON', async () => {
    const login = auth.login({ username: 'polash', password: 'old' }, '654321');
    await flush();
    const authorize = http.expectOne((r) => r.url === `${oauth}/authorize`);
    expect(authorize.request.params.get('totp_code')).toBe('654321');
    authorize.flush(
      { error: 'password_expired', password_policy: POLICY_WIRE },
      { status: 403, statusText: 'Forbidden' },
    );
    expect(await login).toMatchObject({ kind: 'expired', policy: { minLength: 10 } });

    const change = auth.changePassword({
      username: 'polash',
      currentPassword: 'old',
      newPassword: 'New-Password-1',
    });
    const req = http.expectOne(`${oauth}/password`);
    expect(req.request.body).toEqual({
      client_id: environment.clientId,
      username: 'polash',
      currentPassword: 'old',
      newPassword: 'New-Password-1',
    });
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(await change).toBeNull();
  });
});
