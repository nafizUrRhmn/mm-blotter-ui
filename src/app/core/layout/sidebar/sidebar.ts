import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { NavConfigService } from '../../services/nav-config.service';
import { UiStateService } from '../../services/ui-state.service';
import { NavItem } from '../../models/nav.model';
import { Icon } from '../../../shared/components/icon/icon';

const COLLAPSED_KEY = 'mmb.sidebar.collapsedGroups';

/**
 * Server-driven sidebar: sections → items, where an item with children is a collapsible group
 * (e.g. Pages → MM Blotter ▾). Groups start expanded; a user's collapse choice is remembered in
 * this browser, and the group holding the current page is always opened.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, Icon],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  readonly nav = inject(NavConfigService);
  readonly ui = inject(UiStateService);
  private readonly router = inject(Router);

  private readonly collapsedGroups = signal<Set<string>>(readCollapsed());

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  constructor() {
    // Open the group that contains the current page — on navigation only. The collapse state is
    // written untracked, otherwise collapsing that group would re-run this effect and reopen it.
    effect(() => {
      const path = this.url().split(/[?#]/)[0];
      const sections = this.nav.sections();
      untracked(() => {
        for (const section of sections) {
          for (const item of section.items) {
            if (item.children?.some((c) => c.route && (path === c.route || path.startsWith(c.route + '/')))) {
              this.setCollapsed(item.id, false);
            }
          }
        }
      });
    });
  }

  isOpen(group: NavItem): boolean {
    return !this.collapsedGroups().has(group.id);
  }

  toggleGroup(group: NavItem): void {
    if (this.ui.sidebarCollapsed()) {
      this.ui.toggleSidebar();
      this.setCollapsed(group.id, false);
      return;
    }
    this.setCollapsed(group.id, this.isOpen(group));
  }

  /** Star inside the link: pin / unpin without navigating. */
  toggleFavorite(event: Event, code: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.nav.toggleFavorite(code);
  }

  private setCollapsed(id: string, collapsed: boolean): void {
    const current = this.collapsedGroups();
    if (current.has(id) === collapsed) return;
    const next = new Set(current);
    if (collapsed) next.add(id);
    else next.delete(id);
    this.collapsedGroups.set(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
    } catch {
      // storage unavailable (private mode): the choice just isn't remembered
    }
  }
}

function readCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
