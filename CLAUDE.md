# CLAUDE.md — mm-blotter-ui

MM Blotter SPA: Angular 22, standalone components, signals, Bootstrap 5, its own icon set
(`shared/components/icon/icon.ts`, no icon library). Dev server on **:4201** (ACS's UI uses :4200).
Backend: `../mm-blotter-service` (`http://localhost:8087/mmb`). Identity: ACS
(`http://localhost:8086/acs`); MM Blotter is the ACS tenant `MM-BLOTTER`.

## Commands (Node ≥ 22.22, npm 10 or 11)

- Install: `npm ci`
- Dev server: `npx ng serve` (port 4201 is set in `angular.json`; `npm start` does the same)
- Build: `npx ng build` (production: `environment.prod.ts` via `fileReplacements`)
- Test: `npx ng test --watch=false` (Vitest via `@angular/build:unit-test`, jsdom).
  Single spec: `npx ng test --watch=false --include src/app/core/services/pkce.spec.ts`
- Format: Prettier (`.prettierrc`); much of the existing code is not yet formatted, so format only
  the files you touch.

## Configuration

`src/environments/environment.ts` (dev) / `environment.prod.ts` (prod):
`apiUrl` (`http://localhost:8087/mmb` / `/mmb`), `acsUrl` (`http://localhost:8086/acs` / `/acs`),
`clientId` `MM-BLOTTER` (ACS tenant id; OAuth2 wire name `client_id`), `redirectUri`
(`http://localhost:4201/callback`; must be registered on the ACS tenant even though the flow is
headless and there is no `/callback` route), `acsModuleId` `MM_BLOTTER`.
`API_BASE_URL` (`core/api/api.config.ts`) = `${apiUrl}/api/v1`. There is no dev proxy: the API's
CORS allows http://localhost:4201, ACS's allows any origin.

## Authentication (ACS)

`core/services/auth.service.ts`:
- **Login** = ACS headless authorization_code + PKCE (`core/services/pkce.ts`, S256), so no client
  secret ships: `POST {acs}/oauth2/authorize` with `client_id`, `response_type=code`,
  `redirect_uri`, `code_challenge`, `username`, `password` → `{code}`; then `POST {acs}/oauth2/token`
  with `grant_type=authorization_code`, `code`, `code_verifier`, `client_id`, `redirect_uri`. ACS's
  `authorize` and `token` read **query-string** parameters only (`HttpParams`, null body). The
  username is the ACS `org_user_name`. `login(credentials, totpCode?)` resolves to a `LoginOutcome`
  (`ok` / `mfa{enrolled}` / `expired{policy}` / `error{AcsError}`); an optional `totp_code` goes on
  authorize.
- **Tenant security policy** (ACS Tenant Settings: MFA, password strength/history/expiry). ACS
  errors on `/oauth2/*` are problem+json with an OAuth2-style `error` code, mapped by
  `classifyAcsError()` (`auth.service.ts`, spec'd):
  - 403 `mfa_required` (+ `mfa_token`, `enrolled`, `expires_in`): the PKCE verifier and the opaque,
    single-use `mfa_token` stay **pending in `AuthService`**. Not enrolled → `startMfaEnrolment()`
    (`POST /oauth2/mfa/enroll` → secret, `otpauth_uri`, `qr_code_data_uri` or null). Then
    `completeMfa(code)` (`POST /oauth2/mfa/verify` → `{code}`) and the usual token exchange with the
    pending verifier. 5 minutes and 5 wrong codes per `mfa_token`; 10 wrong codes in a row block the
    ACS account.
  - 401 `invalid_totp` (+ `attempts_remaining` on verify; 0 = restart), 401 `invalid_mfa_token`
    (expired/used step → back to the credentials form; `AcsError.restart`).
  - 403 `password_expired` (+ `password_policy`, snake_case incl. `max_bytes`; only after the right
    password) → `changePassword()` = `POST /oauth2/password` (JSON `client_id, username,
    currentPassword, newPassword, totp_code?`, 204; works while expired; ends all ACS sessions).
    It can answer 403 `mfa_required` (no token: resend with `totp_code`), 400
    `password_policy_violation` / `password_reused` (+ `violations`), 401 `invalid_grant`.
  - `invalid_grant` or a plain 400/401 → "Invalid username or password." (ACS never says which
    part was wrong; a blocked account looks the same). 429 = ACS rate limiter.
  - The mfa/enroll, mfa/verify and password endpoints take **JSON bodies**. They exist only with
    ACS `feature.mfa.enabled` (enroll/verify 404 otherwise, but then MFA is never demanded).
- **Login page** (`features/auth/login/`, spec'd): steps `credentials` → `mfa-enrol` (QR `<img>`,
  secret in groups of 4 with Copy, otpauth link) or `mfa-code` (6-digit, `inputmode=numeric`,
  `autocomplete=one-time-code`) → signed in; `password_expired` → `change-password` (new + confirm,
  live policy checklist via `passwordChecks()`, server `violations`, TOTP field once ACS asks) →
  automatic sign-in with the new password (which may lead to the MFA step; the code just used for
  the change can't be reused for 90 s). "Back to sign in" calls `auth.cancelLogin()` and resets.
- Tokens live in `localStorage` (`mmb.accessToken`, `mmb.refreshToken`) and are followed across
  tabs through the `storage` event. `isAuthenticated` = a refresh token (or a decodable access
  token) is held.
- `session()` is decoded from the access token (display only; the API verifies it): `username` =
  `sub`, `email`, `id` = `userId`, `name` = `username` claim (ACS tokens carry no full name),
  `roles` = the `ROLE_MMB_*` entries of `roles` without `ROLE_`, `permissions` = `roles`, and a
  role label (Treasury Dealer / Treasury Back Office / Mid Office / Treasury Viewer).
- **Refresh** (`refresh()`): `grant_type=refresh_token`, single in-flight observable
  (`shareReplay(1)`), reading the refresh token from storage (another tab may have rotated it).
  ACS rotates refresh tokens and treats reuse as theft (ends the session). **Do not add a second
  refresh path.** Failure → `clearSession()` and `null`.
- **Logout** only clears local state (ACS has no tenant logout endpoint).
- Name, e-mail, password and roles are managed in ACS; the profile page is read-only.

`core/api/auth.interceptor.ts` attaches `Bearer` to `API_BASE_URL` calls and to ACS
`/api/v1/acs/**` (not `public/`), never to `/oauth2/**`. On 401 it calls `auth.refresh()` once and
replays; `null` → `/login?redirectTo=`. Error toasts only for MM Blotter API calls (opt out with
`SKIP_ERROR_TOAST`).

## Roles and menus

- `core/auth/api-roles.ts`: `ApiRoles` (same names/values as the API's `constant/ApiRoles.java`,
  e.g. `DEAL_EXPORT: 'MMB_DEAL_EXPORT'`) and `ROUTE_ROLES` (route → role a link needs).
  Components gate with `auth.hasPermission(ApiRoles.X)` or, in templates, expose
  `readonly R = ApiRoles` and use `*appHasPermission="R.X"`. UI gating only.
- `core/services/nav-config.service.ts`: `load(username)` fetches ACS
  `GET /api/v1/acs/me/menus?moduleId=MM_BLOTTER` (flat list of the business group's whole subtree;
  on error `[]`) and `GET {api}/me/favorites` in parallel. `buildSections()`: the root row
  (no parent) is a container → its children are sections → their children items (an item with
  children is a collapsible group); ordered by `menuSeq`; leaves whose `ROUTE_ROLES` role the user
  lacks are dropped, then empty groups / sections; visible favorites are prepended as a
  "Favorites" section (`<menuId>-fav`). `toggleFavorite` → `PUT {api}/me/favorites
  {menuCodes: [menuIds]}`. `accessibleRoutes` / `canAccess` / `homeRoute` drive
  `menuAccessGuard` and `homeRedirectGuard` (`core/guards/auth.guard.ts`).
- The menu tree, role table and test users are documented in
  `../mm-blotter-service/docs/MENUS.txt` and `../mm-blotter-service/CLAUDE.md`.

## Code map (`src/app/`)

| Folder | Responsibility |
|---|---|
| `core/api/` | `API_BASE_URL`, `SKIP_ERROR_TOAST`, `problemMessage`, `authInterceptor` |
| `core/auth/` | `ApiRoles`, `ROUTE_ROLES` |
| `core/services/` | `AuthService` (ACS session), `pkce`, `NavConfigService` (ACS menu), `UserService` (profile view), notifications, toasts, theme, `UiStateService` (global blotter date: `date()`, `dateParams()`) |
| `core/guards/` | `authGuard`, `guestGuard`, `menuAccessGuard`, `homeRedirectGuard` |
| `core/layout/` | shell, sidebar, topbar |
| `features/*` | one folder per page; each `*.service.ts` loads from the API into signals. `features/admin/` = Integrations and the business Audit Log (Users / Roles / Menus are in ACS) |
| `shared/` | icons, charts, cards, `*appHasPermission`, toasts, pipes |

Rules: keep components free of HTTP (services call the API, components read signals); use
`inject()` and signals; business dates come from `UiStateService`.
