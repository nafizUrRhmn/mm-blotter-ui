export interface NavItem {
  id: string;
  label: string;
  icon: string;
  route?: string;
  children?: NavItem[];
}

export interface NavSection {
  id: string;
  title?: string;
  items: NavItem[];
}

export interface WorkspaceConfig {
  code: string;
  name: string;
  subtitle: string;
  switchLabel: string;
  switchRoute: string;
  homeRoute: string;
}
