import { Routes } from '@angular/router';
import { Shell } from './core/layout/shell/shell';
import { authGuard, guestGuard, homeRedirectGuard, menuAccessGuard } from './core/guards/auth.guard';
import { Placeholder } from './features/placeholder/placeholder';

/**
 * Routes register *components*; who may open them is decided by the user's ACS menu filtered by
 * their ACS API roles (`menuAccessGuard`) and, ultimately, by the API's role checks. Users, roles
 * and menus are administered in ACS, so there are no admin pages for them here.
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
    canActivate: [guestGuard],
    title: 'Sign in · MM Blotter',
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    canActivateChild: [menuAccessGuard],
    children: [
      { path: '', pathMatch: 'full', canActivate: [homeRedirectGuard], component: Placeholder },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile').then((m) => m.Profile),
        title: 'My Profile · MM Blotter',
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Dashboard · MM Blotter',
      },
      {
        path: 'overview',
        loadComponent: () => import('./features/overview/overview').then((m) => m.Overview),
        title: 'Overview · MM Blotter',
      },
      {
        path: 'deal-details',
        loadComponent: () => import('./features/deal-details/deal-details').then((m) => m.DealDetails),
        title: 'Deal Details · MM Blotter',
      },
      {
        path: 'crr-monitor',
        loadComponent: () => import('./features/crr-monitor/crr-monitor').then((m) => m.CrrMonitor),
        title: 'CRR Monitor · MM Blotter',
      },
      {
        path: 'rtgs',
        loadComponent: () => import('./features/rtgs/rtgs').then((m) => m.Rtgs),
        title: 'RTGS · MM Blotter',
      },
      {
        path: 'forecast-data',
        loadComponent: () => import('./features/forecast-data/forecast-data').then((m) => m.ForecastData),
        title: 'Forecast Data · MM Blotter',
      },
      { path: 'future-fund-flow', component: Placeholder, data: { title: 'Future Fund Flow' } },
      {
        path: 'approval-req',
        loadComponent: () => import('./features/approvals/approvals').then((m) => m.Approvals),
        title: 'Approval Requests · MM Blotter',
      },
      {
        path: 'payment-status',
        loadComponent: () => import('./features/payment-status/payment-status').then((m) => m.PaymentStatus),
        title: 'Payment Status · MM Blotter',
      },
      {
        path: 'manual-inputs',
        loadComponent: () => import('./features/manual-inputs/manual-inputs').then((m) => m.ManualInputs),
        title: 'Manual Inputs · MM Blotter',
      },
      {
        path: 'fx-blotter',
        loadComponent: () => import('./features/fx/fx-blotter').then((m) => m.FxBlotter),
        title: 'FX Blotter · MM Blotter',
      },
      {
        path: 'maturity-bucket',
        loadComponent: () => import('./features/fx/maturity-bucket').then((m) => m.MaturityBucket),
        title: 'Maturity Bucket · MM Blotter',
      },
      {
        path: 'fc-placement',
        loadComponent: () => import('./features/fx/fc-placement').then((m) => m.FcPlacement),
        title: 'FC Placement · MM Blotter',
      },
      {
        path: 'fx-maturity',
        loadComponent: () => import('./features/fx/fx-maturity').then((m) => m.FxMaturity),
        title: 'FX Maturity · MM Blotter',
      },
      {
        path: 'admin',
        children: [
          {
            path: 'integrations',
            loadComponent: () => import('./features/admin/integrations/admin-integrations').then((m) => m.AdminIntegrations),
            title: 'Integrations · MM Blotter',
          },
          {
            path: 'audit',
            loadComponent: () => import('./features/admin/audit/admin-audit').then((m) => m.AdminAudit),
            title: 'Audit Log · MM Blotter',
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
