import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { API_BASE_URL } from '../../core/api/api.config';
import { UiStateService } from '../../core/services/ui-state.service';
import { InstrumentCardConfig } from './instrument-card.model';

/**
 * BRS Annexure A §1.4.1–1.4.6 (Cards 4–9): Maturity/New/Net (or Inflow/Outflow/Net) per
 * instrument with counterparty drilldown, served by `GET /overview/instrument-cards`.
 */
@Injectable({ providedIn: 'root' })
export class InstrumentCardsService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly ui = inject(UiStateService);
  private readonly cardsSignal = signal<InstrumentCardConfig[]>([]);

  readonly cards = this.cardsSignal.asReadonly();

  load(): void {
    this.http
      .get<InstrumentCardConfig[]>(`${this.api}/overview/instrument-cards`, { params: this.ui.dateParams() })
      .subscribe((cards) => this.cardsSignal.set(cards));
  }
}
