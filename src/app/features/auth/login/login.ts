import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LoginOutcome, MfaEnrolment, PasswordPolicy } from '../../../core/models/auth.model';
import { AuthService, passwordChecks } from '../../../core/services/auth.service';
import { NavConfigService } from '../../../core/services/nav-config.service';
import { Icon } from '../../../shared/components/icon/icon';

/**
 * credentials → (tenant enforces MFA) mfa-enrol (first time) or mfa-code → signed in.
 * credentials → (password expired) change-password → signed in again with the new password
 * (which may lead to the MFA steps).
 */
export type LoginStep = 'credentials' | 'mfa-enrol' | 'mfa-code' | 'change-password';

const SIX_DIGITS = /^\d{6}$/;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, Icon],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly nav = inject(NavConfigService);

  username = '';
  password = '';
  totpCode = '';
  confirmPassword = '';
  readonly newPassword = signal('');

  readonly step = signal<LoginStep>('credentials');
  readonly showPassword = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  /** Non-error notice above the form (e.g. why the step is shown). */
  readonly info = signal<string | null>(null);

  readonly enrolment = signal<MfaEnrolment | null>(null);
  readonly enrolmentLoading = signal(false);
  readonly copied = signal(false);
  /** The secret in groups of 4 for typing into an authenticator app by hand. */
  readonly groupedSecret = computed(
    () =>
      this.enrolment()
        ?.secret.match(/.{1,4}/g)
        ?.join(' ') ?? '',
  );

  readonly policy = signal<PasswordPolicy | null>(null);
  readonly violations = signal<string[]>([]);
  /** ACS asked for a TOTP code to confirm the password change (MFA on and user enrolled). */
  readonly passwordNeedsTotp = signal(false);
  readonly checks = computed(() => {
    const policy = this.policy();
    return policy ? passwordChecks(policy, this.newPassword(), this.username) : [];
  });

  readonly heading = computed(() => {
    switch (this.step()) {
      case 'mfa-enrol':
        return {
          title: 'Set up two-step sign-in',
          text: 'Scan the QR code with an authenticator app, then enter the 6-digit code it shows.',
        };
      case 'mfa-code':
        return {
          title: 'Two-step sign-in',
          text: 'Enter the 6-digit code from your authenticator app.',
        };
      case 'change-password':
        return { title: 'Change your password', text: 'Choose a new password to continue.' };
      default:
        return {
          title: 'Welcome back',
          text: "Sign in to view today's blotter, CRR position and deal flow.",
        };
    }
  });

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  async submit(): Promise<void> {
    this.error.set(null);
    this.info.set(null);

    if (!this.username.trim() || !this.password.trim()) {
      this.error.set('Please enter your username and password.');
      return;
    }

    this.submitting.set(true);
    // ACS sign-in (tenant MM-BLOTTER): username is the ACS org user name.
    const outcome = await this.auth.login({ username: this.username, password: this.password });
    this.submitting.set(false);
    await this.handle(outcome);
  }

  async verifyCode(): Promise<void> {
    this.error.set(null);
    const code = this.totpCode.trim();
    if (!SIX_DIGITS.test(code)) {
      this.error.set('Enter the 6-digit code from your authenticator app.');
      return;
    }
    this.submitting.set(true);
    const outcome = await this.auth.completeMfa(code);
    this.submitting.set(false);
    this.totpCode = '';
    await this.handle(outcome);
  }

  async changePassword(): Promise<void> {
    this.error.set(null);
    this.violations.set([]);
    const newPassword = this.newPassword();
    if (!newPassword) {
      this.error.set('Enter a new password.');
      return;
    }
    if (newPassword !== this.confirmPassword) {
      this.error.set('The two new passwords do not match.');
      return;
    }
    if (newPassword === this.password) {
      this.error.set('The new password must be different from the current one.');
      return;
    }
    const code = this.totpCode.trim();
    if (this.passwordNeedsTotp() && !SIX_DIGITS.test(code)) {
      this.error.set('Enter the 6-digit code from your authenticator app.');
      return;
    }

    this.submitting.set(true);
    const failure = await this.auth.changePassword({
      username: this.username,
      currentPassword: this.password,
      newPassword,
      totpCode: this.passwordNeedsTotp() ? code : undefined,
    });
    this.totpCode = '';

    if (failure) {
      this.submitting.set(false);
      switch (failure.kind) {
        case 'mfa_required':
          this.passwordNeedsTotp.set(true);
          this.error.set(
            'Enter the 6-digit code from your authenticator app to confirm the change.',
          );
          return;
        case 'password_policy':
          if (failure.policy) this.policy.set(failure.policy);
          this.violations.set(failure.violations ?? []);
          this.error.set(failure.message);
          return;
        case 'invalid_credentials':
          this.backToSignIn();
          this.error.set('Your current password was not accepted. Sign in again.');
          return;
        default:
          this.error.set(failure.message);
          return;
      }
    }

    // ACS ended every session; sign in again with the new password.
    this.password = newPassword;
    const usedTotp = this.passwordNeedsTotp();
    this.resetPasswordForm();
    const outcome = await this.auth.login({ username: this.username, password: newPassword });
    this.submitting.set(false);
    await this.handle(outcome);
    if (this.step() !== 'credentials') {
      this.info.set(
        usedTotp
          ? 'Password changed. Wait for the next code in your authenticator app to finish signing in.'
          : 'Password changed. Finish signing in.',
      );
    } else if (!this.error()) {
      this.info.set('Password changed.');
    }
  }

  async copySecret(): Promise<void> {
    const secret = this.enrolment()?.secret;
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.error.set('Copy failed. Select the key and copy it by hand.');
    }
  }

  /** Abandons the MFA / password step and starts over from the credentials form. */
  backToSignIn(): void {
    this.auth.cancelLogin();
    this.step.set('credentials');
    this.password = '';
    this.totpCode = '';
    this.enrolment.set(null);
    this.copied.set(false);
    this.policy.set(null);
    this.resetPasswordForm();
    this.error.set(null);
    this.info.set(null);
  }

  private resetPasswordForm(): void {
    this.newPassword.set('');
    this.confirmPassword = '';
    this.violations.set([]);
    this.passwordNeedsTotp.set(false);
  }

  private async handle(outcome: LoginOutcome): Promise<void> {
    switch (outcome.kind) {
      case 'ok':
        this.navigateAfterLogin();
        return;
      case 'mfa':
        this.error.set(null);
        this.totpCode = '';
        if (outcome.enrolled) {
          this.step.set('mfa-code');
          return;
        }
        this.step.set('mfa-enrol');
        await this.loadEnrolment();
        return;
      case 'expired':
        this.error.set(null);
        this.policy.set(outcome.policy);
        this.resetPasswordForm();
        this.step.set('change-password');
        this.info.set(outcome.message);
        return;
      case 'error':
        if (outcome.error.restart) this.backToSignIn();
        this.error.set(outcome.error.message);
        return;
    }
  }

  private async loadEnrolment(): Promise<void> {
    this.enrolment.set(null);
    this.enrolmentLoading.set(true);
    const result = await this.auth.startMfaEnrolment();
    this.enrolmentLoading.set(false);
    if (result.kind === 'ok') {
      this.enrolment.set(result.enrolment);
      return;
    }
    if (result.error.restart) this.backToSignIn();
    this.error.set(result.error.message);
  }

  private navigateAfterLogin(): void {
    // Only follow same-app relative redirects; the menu guard then checks the user may open it.
    const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');
    this.router.navigateByUrl(
      redirectTo?.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/',
    );
  }
}
