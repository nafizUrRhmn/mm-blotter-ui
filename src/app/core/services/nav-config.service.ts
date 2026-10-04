import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_BASE_URL } from '../api/api.config';
import { ROUTE_ROLES } from '../auth/api-roles';
import { NavItem, NavSection, WorkspaceConfig } from '../models/nav.model';
import { AuthService } from './auth.service';

/** One row of ACS `GET /api/v1/acs/me/menus?moduleId=` (a flat list of the whole menu subtree). */
export interface AcsMenu {
  menuId: string;
  menuName: string;
  menuLogo: string | null;
  menuSeq: number | null;
  parentMenuId: string | null;
  menuUrl: string | null;
}

/** Workspace header (logo, name, switch link). Not part of the ACS menu data. */
const DEFAULT_WORKSPACE: WorkspaceConfig = {
  code: 'MM',
  name: 'MM Blotter',
  subtitle: 'Switch to FX Blotter',
  switchLabel: 'Switch to FX Blotter',
  switchRoute: '/fx-blotter',
  homeRoute: '/overview',
};

/** Routes every signed-in user may open, regardless of menus. */
const ALWAYS_ALLOWED = ['/profile'];

/**
 * The sidebar comes from ACS: MM Blotter is the ACS module `MM_BLOTTER`, whose menu tree is
 * mapped to the user's business group (tenant audience). ACS returns the group's whole tree, not a
 * per-role one, so links whose page needs a role the user lacks (`ROUTE_ROLES`) are hidden here,
 * and so are groups and sections left empty. The tree is: module root → sections → items, where an
 * item with children is a collapsible group. Favorites (ACS menu ids) are stored by the MM Blotter
 * API. The same list drives route guarding (`canAccess`) so the UI never offers a dead end.
 */
@Injectable({ providedIn: 'root' })
export class NavConfigService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly auth = inject(AuthService);

  private readonly workspaceSignal = signal<WorkspaceConfig>(DEFAULT_WORKSPACE);
  private readonly sectionsSignal = signal<NavSection[]>([]);
  private loading: Promise<void> | null = null;
  private loadedFor: string | null = null;

  readonly workspace = this.workspaceSignal.asReadonly();
  readonly sections = this.sectionsSignal.asReadonly();

  /** Every route reachable from the user's menu (including nested items). */
  readonly accessibleRoutes = computed(() => {
    const routes = new Set<string>(ALWAYS_ALLOWED);
    const walk = (items: NavItem[]) =>
      items.forEach((item) => {
        if (item.route) routes.add(item.route);
        if (item.children) walk(item.children);
      });
    this.sectionsSignal().forEach((s) => walk(s.items));
    return routes;
  });

  /** Landing page: the workspace home if permitted, else the first menu entry. */
  readonly homeRoute = computed(() => {
    const routes = this.accessibleRoutes();
    const home = this.workspaceSignal().homeRoute;
    if (routes.has(home)) return home;
    return [...routes].find((r) => !ALWAYS_ALLOWED.includes(r)) ?? '/profile';
  });

  /** ACS menu ids pinned to the user's Favorites section, in order. */
  readonly favoriteCodes = computed(() =>
    (this.sectionsSignal().find((s) => s.id === 'favorites')?.items ?? []).map((i) =>
      i.id.replace(/-fav$/, ''),
    ),
  );

  isFavorite(code: string): boolean {
    return this.favoriteCodes().includes(code.replace(/-fav$/, ''));
  }

  /** Pins / unpins a menu item (`PUT /me/favorites`), then reloads the sidebar. */
  toggleFavorite(code: string): void {
    const id = code.replace(/-fav$/, '');
    const current = this.favoriteCodes();
    const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
    this.http.put<string[]>(`${this.api}/me/favorites`, { menuCodes: next }).subscribe(() => {
      if (this.loadedFor) this.load(this.loadedFor, true);
    });
  }

  /** Loads the menu once per user; pass `force` after menus/roles change. */
  load(userKey: string, force = false): Promise<void> {
    if (!force && this.loadedFor === userKey) return Promise.resolve();
    if (!force && this.loading) return this.loading;
    const menus$ = this.http
      .get<AcsMenu[]>(`${environment.acsUrl}/api/v1/acs/me/menus`, {
        params: { moduleId: environment.acsModuleId },
      })
      .pipe(catchError(() => of<AcsMenu[]>([])));
    const favorites$ = this.http
      .get<string[]>(`${this.api}/me/favorites`)
      .pipe(catchError(() => of<string[]>([])));
    this.loading = firstValueFrom(forkJoin([menus$, favorites$]))
      .then(([menus, favorites]) => {
        this.sectionsSignal.set(
          buildSections(menus, favorites, (role) => this.auth.hasPermission(role)),
        );
        this.loadedFor = userKey;
      })
      .finally(() => (this.loading = null));
    return this.loading;
  }

  canAccess(url: string): boolean {
    const path = url.split(/[?#]/)[0];
    for (const route of this.accessibleRoutes()) {
      if (path === route || path.startsWith(route + '/')) return true;
    }
    return false;
  }

  reset(): void {
    this.sectionsSignal.set([]);
    this.loadedFor = null;
  }
}

/**
 * ACS menu rows → sidebar sections. The module's root row (no parent) is a container: its children
 * are the sections, their children the items, and an item with children is a group.
 */
export function buildSections(
  menus: AcsMenu[],
  favoriteIds: string[],
  hasRole: (role: string) => boolean,
): NavSection[] {
  const bySeq = (a: AcsMenu, b: AcsMenu) => (a.menuSeq ?? 0) - (b.menuSeq ?? 0);
  const children = new Map<string, AcsMenu[]>();
  for (const m of menus) {
    if (!m.parentMenuId) continue;
    const list = children.get(m.parentMenuId) ?? [];
    list.push(m);
    children.set(m.parentMenuId, list);
  }
  children.forEach((list) => list.sort(bySeq));

  const visible = (route: string | null) => {
    if (!route) return false;
    const role = ROUTE_ROLES[route];
    return !role || hasRole(role);
  };
  const toItem = (m: AcsMenu): NavItem | null => {
    const kids = children.get(m.menuId) ?? [];
    if (kids.length) {
      const items = kids.map(toItem).filter((i): i is NavItem => i !== null);
      return items.length
        ? { id: m.menuId, label: m.menuName, icon: m.menuLogo ?? 'grid', children: items }
        : null;
    }
    return visible(m.menuUrl)
      ? {
          id: m.menuId,
          label: m.menuName,
          icon: m.menuLogo ?? 'grid',
          route: m.menuUrl ?? undefined,
        }
      : null;
  };

  const sections: NavSection[] = [];
  for (const root of menus.filter((m) => !m.parentMenuId).sort(bySeq)) {
    for (const section of children.get(root.menuId) ?? []) {
      const items = (children.get(section.menuId) ?? [])
        .map(toItem)
        .filter((i): i is NavItem => i !== null);
      if (items.length) sections.push({ id: section.menuId, title: section.menuName, items });
    }
  }

  const leaves = new Map<string, NavItem>();
  const collect = (items: NavItem[]) =>
    items.forEach((i) => (i.children ? collect(i.children) : leaves.set(i.id, i)));
  sections.forEach((s) => collect(s.items));
  const favorites = favoriteIds
    .map((id) => leaves.get(id))
    .filter((i): i is NavItem => !!i)
    .map((i) => ({ ...i, id: `${i.id}-fav` }));
  return favorites.length
    ? [{ id: 'favorites', title: 'Favorites', items: favorites }, ...sections]
    : sections;
}
