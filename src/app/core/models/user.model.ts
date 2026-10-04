export interface UserProfile {
  name: string;
  email: string;
  role: string;
  initials: string;
}

export interface ProfileMenuItem {
  id: string;
  label: string;
  icon: string;
  route?: string;
  action?: 'toggle-theme' | 'sign-out';
  danger?: boolean;
}
