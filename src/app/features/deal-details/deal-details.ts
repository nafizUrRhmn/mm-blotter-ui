import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { UiStateService } from '../../core/services/ui-state.service';
import { HasPermission } from '../../shared/directives/has-permission.directive';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DealDetailsService } from './deal-details.service';
import { DealFilterService } from './deal-filter.service';
import { Deal, DealTypeKey, SettlementStatus } from './deal.model';
import { Icon } from '../../shared/components/icon/icon';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { downloadExcel, ExcelSheet } from '../../shared/utils/excel-export';
import { ApiRoles } from '../../core/auth/api-roles';

@Component({
  selector: 'app-deal-details',
  standalone: true,
  imports: [CommonModule, FormsModule, Icon, PageHeader, HasPermission],
  templateUrl: './deal-details.html',
  styleUrl: './deal-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DealDetails {
  /** ACS API role ids, for `*appHasPermission` in the template. */
  readonly R = ApiRoles;

  private readonly service = inject(DealDetailsService);
  readonly filter = inject(DealFilterService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly ui = inject(UiStateService);

  readonly searchTerm = signal('');
  readonly filterOpen = signal(false);
  readonly expanded = signal<string | null>(null);
  readonly statuses: SettlementStatus[] = ['Settled', 'Processing', 'Pending'];

  /** Types the filter knows; derived rows such as G-Sec maturity / auction are always shown. */
  private readonly knownTypes = computed(
    () => new Set(this.filter.dealTypeGroups().flatMap((g) => g.options.map((o) => o.key as string))),
  );

  constructor() {
    const ui = this.ui;
    this.filter.load();
    effect(() => {
      ui.refreshTick();
      ui.date();
      untracked(() => this.service.load());
    });
  }

  readonly groups = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const selectedCards = this.filter.selectedCards();
    const selectedTypes = this.filter.selectedDealTypes();
    const groups = this.service.data();

    return groups
      .filter((group) => selectedCards.has(group.id))
      .map((group) => ({
        ...group,
        deals: group.deals.filter((d) => {
          if (this.knownTypes().has(d.dealTypeKey) && !selectedTypes.has(d.dealTypeKey)) return false;
          if (!term) return true;
          return (
            d.counterparty.toLowerCase().includes(term) ||
            d.type.toLowerCase().includes(term) ||
            (d.dealNo ?? '').toLowerCase().includes(term)
          );
        }),
      }))
      .filter((group) => group.deals.length > 0);
  });

  toggleFilterPanel(): void {
    this.filterOpen.update((v) => !v);
  }

  toggleCard(id: string): void {
    this.filter.toggleCard(id);
  }

  toggleDealType(key: DealTypeKey): void {
    this.filter.toggleDealType(key);
  }

  isCardSelected(id: string): boolean {
    return this.filter.selectedCards().has(id);
  }

  isDealTypeSelected(key: DealTypeKey): boolean {
    return this.filter.selectedDealTypes().has(key);
  }

  exportToExcel(): void {
    const columns: { header: string; key: keyof Deal; type?: 'String' | 'Number' }[] = [
      { header: 'Type', key: 'type' },
      { header: 'Counterparty', key: 'counterparty' },
      { header: 'Volume (Cr.)', key: 'volume', type: 'Number' },
      { header: 'Rate (%)', key: 'rate', type: 'Number' },
      { header: 'Tenor', key: 'tenor' },
      { header: 'Deal No', key: 'dealNo' },
      { header: 'Payment Mode', key: 'paymentStatus' },
      { header: 'Settlement Status', key: 'settlementStatus' },
    ];

    const sheets: ExcelSheet<Deal>[] = this.groups().map((group) => ({
      name: group.title,
      columns,
      rows: group.deals,
    }));

    if (!sheets.length) return;

    const today = this.ui.date() ?? new Date().toISOString().slice(0, 10);
    downloadExcel(`deal-details-${today}`, sheets);
  }

  toggleRow(id: string): void {
    this.expanded.update((v) => (v === id ? null : id));
  }

  setStatus(deal: Deal, status: SettlementStatus): void {
    this.service.updateStatus(deal.id, status).subscribe();
  }

  /** Green when settled, red otherwise (BRS §1.5). */
  settlementClass(status: string | null): string {
    if (status === 'Settled') return 'text-bg-success-subtle text-success-emphasis';
    if (status === 'Processing') return 'text-bg-warning-subtle text-warning-emphasis';
    return status ? 'text-bg-danger-subtle text-danger-emphasis' : 'text-bg-secondary-subtle text-secondary-emphasis';
  }

  statusClass(status: string): string {
    switch (status) {
      case 'RTGS':
        return 'text-bg-primary-subtle text-primary-emphasis';
      case 'Cleared':
        return 'text-bg-success-subtle text-success-emphasis';
      case 'Pending':
        return 'text-bg-danger-subtle text-danger-emphasis';
      default:
        return 'text-bg-danger-subtle text-danger-emphasis';
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.filterOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.filterOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.filterOpen.set(false);
  }
}
