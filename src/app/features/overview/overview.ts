import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiStateService } from '../../core/services/ui-state.service';
import { AuthService } from '../../core/services/auth.service';
import { HasPermission } from '../../shared/directives/has-permission.directive';
import { OverviewService } from './overview.service';
import { InstrumentCardsService } from './instrument-cards.service';
import { StatCard, StatRow } from '../../shared/components/stat-card/stat-card';
import { InstrumentCard } from '../../shared/components/instrument-card/instrument-card';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { Icon } from '../../shared/components/icon/icon';
import { CrorePipe } from '../../shared/pipes/crore.pipe';
import { RocEntryType } from './overview.model';
import { ApiRoles } from '../../core/auth/api-roles';

const crore = new CrorePipe();

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, StatCard, InstrumentCard, PageHeader, Icon, CrorePipe, HasPermission],
  templateUrl: './overview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Overview {
  /** ACS API role ids, for `*appHasPermission` in the template. */
  readonly R = ApiRoles;

  private readonly overviewService = inject(OverviewService);
  private readonly instrumentCardsService = inject(InstrumentCardsService);
  private readonly auth = inject(AuthService);
  readonly ui = inject(UiStateService);

  readonly data = this.overviewService.data;
  readonly instrumentCards = this.instrumentCardsService.cards;

  targetInput: number | null = null;

  // Card 10 entry form
  rocBranch = '';
  rocType: RocEntryType = 'DEPOSIT';
  rocAmount: number | null = null;
  rocRemarks = '';
  readonly rocOpen = signal<string | null>(null);

  // Card 11 entry form
  reconDirection: 'IN' | 'OUT' = 'IN';
  reconAmount: number | null = null;
  reconRemarks = '';

  readonly canEditRoc = computed(() => {
    const d = this.data();
    return !!d && this.auth.hasPermission(ApiRoles.ROC_WRITE) && (d.currentDay || d.reconciliationAllowed);
  });

  readonly rocTypes = computed<{ value: RocEntryType; label: string }[]>(() => {
    const d = this.data();
    if (!d) return [];
    if (d.currentDay) {
      return [
        { value: 'DEPOSIT', label: 'Deposit' },
        { value: 'WITHDRAWAL', label: 'Withdrawal' },
        { value: 'TT_IN', label: 'TT In' },
        { value: 'TT_OUT', label: 'TT Out' },
      ];
    }
    return d.reconciliationAllowed ? [{ value: 'RECONCILIATION', label: 'Reconciliation (±)' }] : [];
  });

  readonly dhakaRows = computed<StatRow[]>(() => {
    const d = this.data()?.dhaka;
    if (!d) return [];
    return [
      { label: 'Previous Closing', value: crore.transform(d.previousClosing) },
      { label: 'Previous-day Reconciliation', value: crore.transform(d.previousReconciliation, true) },
      { label: 'Dhaka Opening', value: crore.transform(d.opening) },
      { label: "Today's Net Flow (Cards 4–9)", value: crore.transform(d.flowTotal, true), tone: tone(d.flowTotal) },
    ];
  });

  readonly crrRows = computed<StatRow[]>(() => {
    const c = this.data()?.crr;
    if (!c) return [];
    return [
      { label: `TDTL${c.tdtlMonth ? ' (' + c.tdtlMonth + ')' : ''}`, value: crore.transform(c.tdtl) },
      { label: `CRR Req. ${c.fortnightRatePct}% (fortnightly)`, value: crore.transform(c.crrFortnightRequirement) },
      { label: `CRR Req. ${c.dailyRatePct}% (daily)`, value: crore.transform(c.crrDailyRequirement) },
      { label: `SLR Req. ${c.slrRatePct}%`, value: crore.transform(c.slrRequirement) },
      { label: 'SLR Maintained', value: crore.transform(c.slrMaintained) },
    ];
  });

  constructor() {
    effect(() => {
      this.ui.refreshTick();
      this.ui.date();
      untracked(() => {
        this.overviewService.load();
        this.instrumentCardsService.load();
      });
    });
    effect(() => {
      const types = this.rocTypes();
      if (types.length && !types.some((t) => t.value === this.rocType)) this.rocType = types[0].value;
      const regions = this.data()?.roc.regions ?? [];
      if (regions.length && !this.rocBranch) this.rocBranch = regions[0].key;
    });
  }

  submitTarget(): void {
    const value = this.targetInput;
    if (value === null || value === undefined || String(value) === '') {
      this.overviewService.setTargetClosing(null).subscribe();
      return;
    }
    if (value > 0) {
      this.overviewService.setTargetClosing(value).subscribe(() => (this.targetInput = null));
    }
  }

  clearTarget(): void {
    this.overviewService.setTargetClosing(null).subscribe();
  }

  toggleRoc(key: string): void {
    this.rocOpen.update((k) => (k === key ? null : key));
  }

  addRocEntry(): void {
    const d = this.data();
    if (!d || !this.rocBranch || !this.rocAmount) return;
    this.overviewService
      .addRocEntry(this.rocBranch, this.rocType, this.rocAmount, this.rocRemarks || null, d.businessDate)
      .subscribe(() => {
        this.rocAmount = null;
        this.rocRemarks = '';
        this.instrumentCardsService.load();
      });
  }

  deleteRocEntry(id: string): void {
    this.overviewService.deleteRocEntry(id).subscribe(() => this.instrumentCardsService.load());
  }

  addReconciliation(): void {
    const d = this.data();
    if (!d || !this.reconAmount || this.reconAmount <= 0 || !this.reconRemarks.trim()) return;
    this.overviewService
      .addReconciliation(d.businessDate, this.reconDirection, this.reconAmount, this.reconRemarks.trim())
      .subscribe(() => {
        this.reconAmount = null;
        this.reconRemarks = '';
      });
  }

  deleteReconciliation(id: string): void {
    this.overviewService.deleteReconciliation(id).subscribe();
  }

  entryLabel(type: RocEntryType): string {
    return { DEPOSIT: 'Deposit', WITHDRAWAL: 'Withdrawal', TT_IN: 'TT In', TT_OUT: 'TT Out', RECONCILIATION: 'Reconciliation' }[type];
  }
}

function tone(v: number | null | undefined): 'positive' | 'negative' | 'neutral' {
  return !v ? 'neutral' : v > 0 ? 'positive' : 'negative';
}
