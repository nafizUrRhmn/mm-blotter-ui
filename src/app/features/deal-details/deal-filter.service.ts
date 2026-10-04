import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { API_BASE_URL } from '../../core/api/api.config';
import { CardOption, DealTypeGroup } from './filter.model';
import { DealTypeKey } from './deal.model';

interface DealReference {
  cardOptions: CardOption[];
  dealTypeGroups: DealTypeGroup[];
}

/**
 * Filter panel state. The available cards and deal types are reference data from
 * `GET /deals/reference`, so a new deal type shows up here without a frontend release.
 */
@Injectable({ providedIn: 'root' })
export class DealFilterService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  readonly cardOptions = signal<CardOption[]>([]);
  readonly dealTypeGroups = signal<DealTypeGroup[]>([]);

  private readonly allDealTypeKeys = computed(() =>
    this.dealTypeGroups().flatMap((g) => g.options.map((o) => o.key)),
  );
  private readonly allCardIds = computed(() => this.cardOptions().map((c) => c.id));

  readonly selectedCards = signal<Set<string>>(new Set());
  readonly selectedDealTypes = signal<Set<DealTypeKey>>(new Set());

  readonly isFiltered = computed(
    () =>
      this.selectedCards().size !== this.allCardIds().length ||
      this.selectedDealTypes().size !== this.allDealTypeKeys().length,
  );

  private loaded = false;

  /** Loads reference data once; starts with everything selected. */
  load(): void {
    if (this.loaded) return;
    this.http.get<DealReference>(`${this.api}/deals/reference`).subscribe((ref) => {
      this.cardOptions.set(ref.cardOptions);
      this.dealTypeGroups.set(ref.dealTypeGroups);
      this.loaded = true;
      this.reset();
    });
  }

  toggleCard(id: string): void {
    this.selectedCards.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  toggleDealType(key: DealTypeKey): void {
    this.selectedDealTypes.update((set) => {
      const next = new Set(set);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  reset(): void {
    this.selectedCards.set(new Set(this.allCardIds()));
    this.selectedDealTypes.set(new Set(this.allDealTypeKeys()));
  }
}
