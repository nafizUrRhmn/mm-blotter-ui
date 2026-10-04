/**
 * ACS API role ids used by MM Blotter. Same names and values as the API's
 * `constant/ApiRoles.java`; the roles themselves are defined and assigned in ACS
 * (`database/acs/mm_blotter_acs_seed.sql`). The access token's `roles` claim carries them as
 * `ROLE_<id>`. UI gating only: the API enforces the same roles.
 */
export const ApiRoles = {
  DASHBOARD_VIEW: 'MMB_DASHBOARD_RD',
  OVERVIEW_VIEW: 'MMB_OVERVIEW_RD',
  OVERVIEW_UPDATE_TARGET: 'MMB_TARGET_CTRL',
  RTGS_VIEW: 'MMB_RTGS_RD',
  CRR_VIEW: 'MMB_CRR_RD',
  DEAL_VIEW: 'MMB_DEAL_RD',
  DEAL_EXPORT: 'MMB_DEAL_EXPORT',
  FUND_FLOW_VIEW: 'MMB_FUND_FLOW_RD',
  FX_BLOTTER_VIEW: 'MMB_FX_BLOTTER_RD',
  FX_MATURITY_VIEW: 'MMB_FX_MATURITY_RD',
  FC_PLACEMENT_VIEW: 'MMB_FC_PLACEMENT_RD',
  MATURITY_BUCKET_VIEW: 'MMB_MAT_BUCKET_RD',
  FORECAST_VIEW: 'MMB_FORECAST_RD',
  FORECAST_CREATE: 'MMB_FORECAST_CTRL',
  FORECAST_EXCLUDE: 'MMB_FORECAST_EXCL',
  FORECAST_APPROVE: 'MMB_FORECAST_APPR',
  RECON_WRITE: 'MMB_RECON_CTRL',
  ROC_WRITE: 'MMB_ROC_CTRL',
  FLOW_MANUAL_ENTRY: 'MMB_FLOW_CTRL',
  DEAL_UPDATE_STATUS: 'MMB_DEAL_STS_CTRL',
  APPROVAL_VIEW: 'MMB_APPROVAL_RD',
  APPROVAL_DECIDE: 'MMB_APPROVAL_CTRL',
  INTEGRATION_VIEW: 'MMB_INTEG_RD',
  INTEGRATION_RUN: 'MMB_INTEG_CTRL',
  AUDIT_BUSINESS_READ: 'MMB_AUDIT_RD',
} as const;

export type ApiRole = (typeof ApiRoles)[keyof typeof ApiRoles];

/**
 * The role a sidebar link's route needs. ACS shows a business group's whole menu tree, not a
 * per-role one, so the sidebar hides links whose page the user's roles don't open.
 * Routes not listed here (e.g. `/profile`) need no role.
 */
export const ROUTE_ROLES: Record<string, ApiRole> = {
  '/dashboard': ApiRoles.DASHBOARD_VIEW,
  '/overview': ApiRoles.OVERVIEW_VIEW,
  '/deal-details': ApiRoles.DEAL_VIEW,
  '/payment-status': ApiRoles.DEAL_VIEW,
  '/rtgs': ApiRoles.RTGS_VIEW,
  '/forecast-data': ApiRoles.FORECAST_VIEW,
  '/future-fund-flow': ApiRoles.FUND_FLOW_VIEW,
  '/approval-req': ApiRoles.APPROVAL_VIEW,
  '/crr-monitor': ApiRoles.CRR_VIEW,
  '/fx-blotter': ApiRoles.FX_BLOTTER_VIEW,
  '/maturity-bucket': ApiRoles.MATURITY_BUCKET_VIEW,
  '/fc-placement': ApiRoles.FC_PLACEMENT_VIEW,
  '/fx-maturity': ApiRoles.FX_MATURITY_VIEW,
  '/manual-inputs': ApiRoles.FLOW_MANUAL_ENTRY,
  '/admin/integrations': ApiRoles.INTEGRATION_VIEW,
  '/admin/audit': ApiRoles.AUDIT_BUSINESS_READ,
};
