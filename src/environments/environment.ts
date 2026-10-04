export const environment = {
  production: false,
  /** mm-blotter-service (Spring Boot, context path /mmb). */
  apiUrl: 'http://localhost:8087/mmb',
  /** Access Control Service: issues this app's tokens (MM Blotter is the ACS tenant MM-BLOTTER). */
  acsUrl: 'http://localhost:8086/acs',
  /** ACS tenant id (the OAuth2 wire name is still client_id). */
  clientId: 'MM-BLOTTER',
  /** Must be one of the tenant's redirect URIs registered in ACS (Tenants screen). */
  redirectUri: 'http://localhost:4201/callback',
  /** ACS module whose menu tree is the sidebar (GET /me/menus?moduleId=). */
  acsModuleId: 'MM_BLOTTER',
};
