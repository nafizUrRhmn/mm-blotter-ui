import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { API_BASE_URL } from '../../../core/api/api.config';
import { AuthService } from '../../../core/services/auth.service';
import { UiStateService } from '../../../core/services/ui-state.service';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Icon } from '../../../shared/components/icon/icon';
import { ApiRoles } from '../../../core/auth/api-roles';

interface IntegrationRun {
  id: string;
  source: string;
  businessDate: string;
  mode: string;
  trigger: string;
  startedAt: string;
  finishedAt?: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  records: number;
  message?: string;
  triggeredBy?: string;
}

interface SourceStatus {
  source: string;
  key: string;
  system: string;
  feeds: string;
  mode: 'STUB' | 'HTTP' | 'FILE';
  cron?: string;
  lastRun?: IntegrationRun;
  lastSuccessAt?: string;
}

/**
 * Operations view of the source-system integrations (BRS §11.3): which adapter each source
 * uses (stub / http / file — switched by configuration), schedule, last run, run history and
 * on-demand sync for the selected blotter date.
 */
@Component({
  selector: 'app-admin-integrations',
  standalone: true,
  imports: [CommonModule, PageHeader, Icon],
  template: `
    <app-page-header title="Integrations">
      @if (canRun()) {
        <button class="btn btn-dark btn-sm rounded-pill d-inline-flex align-items-center gap-2" type="button" [disabled]="busy()" (click)="syncAll()">
          <app-icon name="refresh-cw" size="14" /> Sync all · {{ ui.selectedDate() }}
        </button>
      }
    </app-page-header>

    <div class="row g-4 mb-4">
      @for (s of sources(); track s.key) {
        <div class="col-12 col-md-6 col-xl-4">
          <div class="card h-100">
            <div class="card-body d-flex flex-column gap-2 small">
              <div class="d-flex align-items-center gap-2">
                <span class="icon-badge text-bg-secondary-subtle text-secondary-emphasis"><app-icon name="server" size="16" /></span>
                <span class="fw-bold">{{ s.system }}</span>
                <span class="badge ms-auto" [ngClass]="s.mode === 'STUB' ? 'text-bg-warning' : 'text-bg-primary'">{{ s.mode }}</span>
              </div>
              <div class="text-muted">{{ s.feeds }}</div>
              <div><span class="text-muted">Schedule:</span> <code>{{ s.cron || 'manual only' }}</code></div>
              @if (s.lastRun; as r) {
                <div>
                  <span class="text-muted">Last run:</span>
                  <span class="badge ms-1" [ngClass]="statusClass(r.status)">{{ r.status }}</span>
                  {{ r.startedAt | date: 'short' }} · {{ r.trigger | lowercase }} · {{ r.businessDate }}
                </div>
                <div class="text-muted text-truncate" [title]="r.message ?? ''">{{ r.message }}</div>
              } @else {
                <div class="text-muted">Never run.</div>
              }
              @if (canRun()) {
                <button class="btn btn-sm btn-outline-secondary align-self-start mt-auto d-inline-flex align-items-center gap-1" type="button"
                  [disabled]="busy()" (click)="sync(s)">
                  <app-icon name="play" size="12" /> Sync now
                </button>
              }
            </div>
          </div>
        </div>
      }
    </div>

    <div class="card">
      <div class="card-header bg-body fw-bold">Recent runs</div>
      <div class="table-responsive">
        <table class="table table-sm table-hover align-middle mb-0 small">
          <thead>
            <tr><th>Started</th><th>Source</th><th>Date</th><th>Mode</th><th>Trigger</th><th>Status</th><th class="text-end">Records</th><th>Message</th><th>By</th></tr>
          </thead>
          <tbody>
            @for (r of runs(); track r.id) {
              <tr>
                <td class="text-nowrap">{{ r.startedAt | date: 'short' }}</td>
                <td>{{ r.source }}</td>
                <td class="text-nowrap">{{ r.businessDate }}</td>
                <td>{{ r.mode }}</td>
                <td>{{ r.trigger }}</td>
                <td><span class="badge" [ngClass]="statusClass(r.status)">{{ r.status }}</span></td>
                <td class="text-end">{{ r.records }}</td>
                <td class="text-truncate" style="max-width: 360px;" [title]="r.message ?? ''">{{ r.message }}</td>
                <td>{{ r.triggeredBy }}</td>
              </tr>
            } @empty {
              <tr><td colspan="9" class="text-center text-muted py-4">No runs yet.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminIntegrations {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly auth = inject(AuthService);
  readonly ui = inject(UiStateService);

  readonly sources = signal<SourceStatus[]>([]);
  readonly runs = signal<IntegrationRun[]>([]);
  readonly busy = signal(false);
  readonly canRun = computed(() => this.auth.hasPermission(ApiRoles.INTEGRATION_RUN));

  constructor() {
    this.load();
  }

  sync(s: SourceStatus): void {
    this.run(this.http.post<IntegrationRun>(`${this.api}/admin/integrations/${s.key}/sync`, null, { params: this.dateParams() }));
  }

  syncAll(): void {
    this.run(this.http.post<IntegrationRun[]>(`${this.api}/admin/integrations/sync-all`, null, { params: this.dateParams() }));
  }

  statusClass(status: string): string {
    return status === 'SUCCESS' ? 'text-bg-success' : status === 'FAILED' ? 'text-bg-danger' : 'text-bg-secondary';
  }

  private run(call: ReturnType<HttpClient['post']>): void {
    this.busy.set(true);
    call.subscribe({
      next: () => {
        this.busy.set(false);
        this.load();
        this.ui.refresh();
      },
      error: () => this.busy.set(false),
    });
  }

  private dateParams(): HttpParams {
    return this.ui.dateParams();
  }

  private load(): void {
    this.http.get<SourceStatus[]>(`${this.api}/admin/integrations`).subscribe((s) => this.sources.set(s));
    this.http.get<IntegrationRun[]>(`${this.api}/admin/integrations/runs`).subscribe((r) => this.runs.set(r));
  }
}
