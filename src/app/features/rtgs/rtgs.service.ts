import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { API_BASE_URL } from '../../core/api/api.config';
import { UiStateService } from '../../core/services/ui-state.service';
import { CustomerFlowRow, NetByType, RtgsFlowCard, StatusCount } from './rtgs.model';

interface RtgsResponse {
  currentBalance: number;
  bbSod: number;
  topUp: number;
  bbSettled: number;
  settledInflow: number;
  settledOutflow: number;
  projectedClosingBalance: number;
  expectedInflow: number;
  expectedOutflow: number;
  netByType: NetByType[];
  statusCounts: StatusCount[];
  inflow: RtgsFlowCard;
  outflow: RtgsFlowCard;
  customerInflow: CustomerFlowRow[];
  customerOutflow: CustomerFlowRow[];
}

const EMPTY_FLOW: RtgsFlowCard = { id: '', title: '', total: 0, subCards: [] };

/** BRS §1.6 RTGS page, served by `GET /rtgs`. Cards and sub-cards read these signals only. */
@Injectable({ providedIn: 'root' })
export class RtgsService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly ui = inject(UiStateService);

  readonly currentBalance = signal(0);
  readonly bbSod = signal(0);
  readonly topUp = signal(0);
  readonly bbSettled = signal(0);
  readonly settledInflow = signal(0);
  readonly settledOutflow = signal(0);

  readonly projectedClosingBalance = signal(0);
  readonly expectedInflow = signal(0);
  readonly expectedOutflow = signal(0);

  readonly netByType = signal<NetByType[]>([]);
  readonly statusCounts = signal<StatusCount[]>([]);
  readonly inflow = signal<RtgsFlowCard>({ ...EMPTY_FLOW, id: 'inflow', title: 'Tr. Inflow' });
  readonly outflow = signal<RtgsFlowCard>({ ...EMPTY_FLOW, id: 'outflow', title: 'Tr. Outflow' });
  readonly customerInflow = signal<CustomerFlowRow[]>([]);
  readonly customerOutflow = signal<CustomerFlowRow[]>([]);

  readonly customerInflowTotal = computed(() => this.customerInflow().reduce((s, r) => s + r.amount, 0));
  readonly customerOutflowTotal = computed(() => this.customerOutflow().reduce((s, r) => s + r.amount, 0));
  readonly net = computed(() => this.netByType().reduce((s, r) => s + r.amount, 0));

  load(): void {
    this.http.get<RtgsResponse>(`${this.api}/rtgs`, { params: this.ui.dateParams() }).subscribe((r) => {
      this.currentBalance.set(r.currentBalance);
      this.bbSod.set(r.bbSod);
      this.topUp.set(r.topUp);
      this.bbSettled.set(r.bbSettled);
      this.settledInflow.set(r.settledInflow);
      this.settledOutflow.set(r.settledOutflow);
      this.projectedClosingBalance.set(r.projectedClosingBalance);
      this.expectedInflow.set(r.expectedInflow);
      this.expectedOutflow.set(r.expectedOutflow);
      this.netByType.set(r.netByType ?? []);
      this.statusCounts.set(r.statusCounts ?? []);
      this.inflow.set(r.inflow ?? EMPTY_FLOW);
      this.outflow.set(r.outflow ?? EMPTY_FLOW);
      this.customerInflow.set(r.customerInflow ?? []);
      this.customerOutflow.set(r.customerOutflow ?? []);
    });
  }
}
