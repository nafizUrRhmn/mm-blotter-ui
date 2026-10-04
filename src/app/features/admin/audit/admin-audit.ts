import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService, AuditLog } from '../admin-api.service';
import { PageHeader } from '../../../shared/components/page-header/page-header';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-admin-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeader],
  template: `
    <app-page-header title="Audit Log" [subtitle]="scope">
      <input class="form-control form-control-sm" style="width: 150px;" placeholder="Actor" [(ngModel)]="actor" (keyup.enter)="load(0)" />
      <input class="form-control form-control-sm" style="width: 190px;" placeholder="Action, e.g. LOGIN" [(ngModel)]="action" (keyup.enter)="load(0)" />
      <button class="btn btn-sm btn-outline-secondary rounded-pill" type="button" (click)="load(0)">Filter</button>
    </app-page-header>

    <div class="card">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0 small">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
              <th>Outcome</th>
              <th>Details</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            @for (log of logs(); track log.id) {
              <tr>
                <td class="text-nowrap">{{ log.occurredAt | date: 'dd MMM yyyy, HH:mm:ss' }}</td>
                <td class="fw-semibold">{{ log.actor }}</td>
                <td><span class="badge text-bg-light font-monospace">{{ log.action }}</span></td>
                <td>{{ log.targetType }} <span class="text-muted">{{ log.targetId }}</span></td>
                <td>
                  <span class="badge rounded-pill" [class.text-bg-success]="log.outcome === 'SUCCESS'" [class.text-bg-danger]="log.outcome === 'FAILURE'">{{ log.outcome }}</span>
                </td>
                <td class="font-monospace text-muted" style="max-width: 320px; font-size: 0.7rem;">{{ log.details | json }}</td>
                <td class="text-muted">{{ log.ipAddress }}</td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="text-center text-muted py-5">No audit entries.</td></tr>
            }
          </tbody>
        </table>
      </div>
      <div class="card-footer bg-body d-flex justify-content-between align-items-center small">
        <span class="text-muted">{{ total() }} entries</span>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary" type="button" [disabled]="page() === 0" (click)="load(page() - 1)">Previous</button>
          <button class="btn btn-sm btn-outline-secondary" type="button" [disabled]="(page() + 1) * pageSize >= total()" (click)="load(page() + 1)">Next</button>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAudit {
  private readonly api = inject(AdminApiService);

  /** Business events only: security events (sign-ins, access changes) are audited by ACS. */
  readonly scope = 'Business actions, newest first.';

  readonly logs = signal<AuditLog[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly pageSize = PAGE_SIZE;
  actor = '';
  action = '';

  constructor() {
    this.load(0);
  }

  load(page: number): void {
    this.api
      .auditLogs({ actor: this.actor.trim(), action: this.action.trim().toUpperCase() }, page, PAGE_SIZE)
      .subscribe((res) => {
        this.logs.set(res.content);
        this.total.set(res.totalElements);
        this.page.set(res.page);
      });
  }
}
