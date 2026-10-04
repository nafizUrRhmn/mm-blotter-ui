import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AcsError, LoginOutcome, MfaEnrolmentOutcome } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';
import { Login } from './login';

const POLICY = {
  minLength: 10,
  maxBytes: 72,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecial: true,
  historyDepth: 5,
  expiryDays: 90,
};

function acsError(partial: Partial<AcsError>): AcsError {
  return {
    kind: 'unknown',
    code: null,
    status: 400,
    message: 'failed',
    restart: false,
    ...partial,
  };
}

class AuthStub {
  login = vi.fn<(...args: unknown[]) => Promise<LoginOutcome>>();
  startMfaEnrolment = vi.fn<() => Promise<MfaEnrolmentOutcome>>();
  completeMfa = vi.fn<(code: string) => Promise<LoginOutcome>>();
  changePassword = vi.fn<(...args: unknown[]) => Promise<AcsError | null>>();
  cancelLogin = vi.fn();
}

describe('Login steps', () => {
  let auth: AuthStub;
  let login: Login;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    auth = new AuthStub();
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Login);
    login = fixture.componentInstance;
    fixture.detectChanges();
    login.username = 'polash';
    login.password = 'Old-Password1';
  });

  it('signs straight in without MFA', async () => {
    auth.login.mockResolvedValue({ kind: 'ok' });
    await login.submit();
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('enrols a first-time user: QR step, then the code', async () => {
    auth.login.mockResolvedValue({ kind: 'mfa', enrolled: false, expiresIn: 300 });
    auth.startMfaEnrolment.mockResolvedValue({
      kind: 'ok',
      enrolment: {
        secret: 'JBSWY3DPEHPK3PXPAB',
        otpauthUri: 'otpauth://totp/x',
        qrCodeDataUri: 'data:image/png;base64,AAAA',
        issuer: 'MM Blotter',
        accountName: 'polash',
        expiresIn: 300,
      },
    });
    await login.submit();
    expect(login.step()).toBe('mfa-enrol');
    expect(login.groupedSecret()).toBe('JBSW Y3DP EHPK 3PXP AB');

    login.totpCode = '12345';
    await login.verifyCode();
    expect(auth.completeMfa).not.toHaveBeenCalled();
    expect(login.error()).toMatch(/6-digit/);

    auth.completeMfa.mockResolvedValue({ kind: 'ok' });
    login.totpCode = '123456';
    await login.verifyCode();
    expect(auth.completeMfa).toHaveBeenCalledWith('123456');
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('keeps the code step on invalid_totp and restarts on invalid_mfa_token', async () => {
    auth.login.mockResolvedValue({ kind: 'mfa', enrolled: true, expiresIn: 300 });
    await login.submit();
    expect(login.step()).toBe('mfa-code');

    auth.completeMfa.mockResolvedValue({
      kind: 'error',
      error: acsError({ kind: 'invalid_totp', message: 'Wrong code. 4 attempts left.' }),
    });
    login.totpCode = '000000';
    await login.verifyCode();
    expect(login.step()).toBe('mfa-code');
    expect(login.error()).toBe('Wrong code. 4 attempts left.');

    auth.completeMfa.mockResolvedValue({
      kind: 'error',
      error: acsError({ kind: 'invalid_mfa_token', restart: true, message: 'Sign in again.' }),
    });
    login.totpCode = '111111';
    await login.verifyCode();
    expect(login.step()).toBe('credentials');
    expect(login.password).toBe('');
    expect(login.error()).toBe('Sign in again.');
    expect(auth.cancelLogin).toHaveBeenCalled();
  });

  it('changes an expired password (asking for a TOTP when ACS wants one) and signs in again', async () => {
    auth.login.mockResolvedValueOnce({ kind: 'expired', policy: POLICY, message: 'Expired.' });
    await login.submit();
    expect(login.step()).toBe('change-password');
    expect(login.info()).toBe('Expired.');
    expect(login.checks().length).toBeGreaterThan(0);

    login.newPassword.set('New-Password-2');
    login.confirmPassword = 'Different';
    await login.changePassword();
    expect(auth.changePassword).not.toHaveBeenCalled();

    login.confirmPassword = 'New-Password-2';
    auth.changePassword.mockResolvedValueOnce(
      acsError({ kind: 'mfa_required', status: 403, enrolled: true }),
    );
    await login.changePassword();
    expect(login.passwordNeedsTotp()).toBe(true);

    auth.changePassword.mockResolvedValueOnce(
      acsError({ kind: 'password_policy', message: 'Reused.', violations: ['Used before'] }),
    );
    login.totpCode = '222222';
    await login.changePassword();
    expect(login.violations()).toEqual(['Used before']);
    expect(login.error()).toBe('Reused.');

    auth.changePassword.mockResolvedValueOnce(null);
    auth.login.mockResolvedValueOnce({ kind: 'mfa', enrolled: true, expiresIn: 300 });
    login.totpCode = '333333';
    await login.changePassword();
    expect(auth.changePassword).toHaveBeenLastCalledWith({
      username: 'polash',
      currentPassword: 'Old-Password1',
      newPassword: 'New-Password-2',
      totpCode: '333333',
    });
    expect(auth.login).toHaveBeenLastCalledWith({ username: 'polash', password: 'New-Password-2' });
    expect(login.step()).toBe('mfa-code');
    expect(login.info()).toMatch(/Password changed/);
  });

  it('"Back to sign in" resets the flow', async () => {
    auth.login.mockResolvedValue({ kind: 'expired', policy: POLICY, message: 'Expired.' });
    await login.submit();
    login.newPassword.set('abc');
    login.backToSignIn();
    expect(login.step()).toBe('credentials');
    expect(login.newPassword()).toBe('');
    expect(login.policy()).toBeNull();
    expect(login.info()).toBeNull();
    expect(auth.cancelLogin).toHaveBeenCalled();
  });
});
