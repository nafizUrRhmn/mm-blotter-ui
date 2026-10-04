import { ApiRoles } from '../auth/api-roles';
import { AcsMenu, buildSections } from './nav-config.service';

const menu = (
  menuId: string,
  parentMenuId: string | null,
  menuSeq: number,
  menuUrl: string | null = null,
): AcsMenu => ({
  menuId,
  menuName: menuId,
  menuLogo: null,
  menuSeq,
  parentMenuId,
  menuUrl,
});

// root → Dashboards (Dashboard, Overview) + Pages (group MM ▾ (RTGS, Forecast)) + Administration (Audit)
const MENUS: AcsMenu[] = [
  menu('root', null, 1),
  menu('dashboards', 'root', 1),
  menu('overview', 'dashboards', 2, '/overview'),
  menu('dashboard', 'dashboards', 1, '/dashboard'),
  menu('pages', 'root', 2),
  menu('mm', 'pages', 1),
  menu('rtgs', 'mm', 1, '/rtgs'),
  menu('forecast', 'mm', 2, '/forecast-data'),
  menu('admin', 'root', 3),
  menu('audit', 'admin', 1, '/admin/audit'),
];

describe('buildSections', () => {
  it('turns the ACS subtree into sections, groups and items ordered by menuSeq', () => {
    const sections = buildSections(MENUS, [], () => true);
    expect(sections.map((s) => s.id)).toEqual(['dashboards', 'pages', 'admin']);
    expect(sections[0].items.map((i) => i.route)).toEqual(['/dashboard', '/overview']);
    expect(sections[1].items[0].children?.map((i) => i.id)).toEqual(['rtgs', 'forecast']);
  });

  it('hides links whose route needs a missing role, and empty groups / sections', () => {
    const viewerRoles = new Set<string>([ApiRoles.OVERVIEW_VIEW, ApiRoles.FORECAST_VIEW]);
    const sections = buildSections(MENUS, [], (r) => viewerRoles.has(r));
    expect(sections.map((s) => s.id)).toEqual(['dashboards', 'pages']);
    expect(sections[0].items.map((i) => i.id)).toEqual(['overview']);
    expect(sections[1].items[0].children?.map((i) => i.id)).toEqual(['forecast']);
  });

  it('prepends visible favorites and drops ones the user cannot open', () => {
    const sections = buildSections(
      MENUS,
      ['audit', 'rtgs', 'unknown'],
      (r) => r !== ApiRoles.AUDIT_BUSINESS_READ,
    );
    expect(sections[0].id).toBe('favorites');
    expect(sections[0].items.map((i) => i.id)).toEqual(['rtgs-fav']);
  });
});
