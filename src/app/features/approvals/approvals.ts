import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApprovalRequest, ApprovalService } from './approval.service';
import { UiStateService } from '../../core/services/ui-state.service';
import { AuthService } from '../../core/services/auth.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { CrorePipe } from '../../shared/pipes/crore.pipe';
import { ApiRoles } from '../../core/auth/api-roles';

/** Approval Request page (BRS §1.9): approve / decline BDT inflow and outflow requests. */
@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeader, CrorePipe],
  template: `
    <app-page-header title="Approval Requests">
      <span class="text-muted small">{{ ui.selectedDate() }}</span>
    </app-page-header>

    <div class="row g-4 mb-4">
      <div class="col-6 col-md-3">
        <div class="card h-100"><div class="card-body">
          <div class="text-muted small">Pending</div><div class="fs-3 fw-bold text-warning">{{ counts().PENDING }}</div>
        </div></div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card h-100"><div class="card-body">
          <div class="text-muted small">Approved</div><div class="fs-3 fw-bold text-success">{{ counts().APPROVED }}</div>
        </div></div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card h-100"><div class="card-body">
          <div class="text-muted small">Declined</div><div class="fs-3 fw-bold text-danger">{{ counts().DECLINED }}</div>
        </div></div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card h-100"><div class="card-body">
          <div class="text-muted small">Approved net</div>
          <div class="fs-3 fw-bold" [class.text-success]="approvedNet() >= 0" [class.text-danger]="approvedNet() < 0">{{ approvedNet() | crore: true }}</div>
        </div></div>
      </div>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th>Requested</th><th>Channel</th><th>Counterparty</th><th>Description</th>
              <th class="text-end">Amount (Cr.)</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            @for (a of service.requests(); track a.id) {
              <tr>
                <td class="small text-nowrap">{{ a.requestedAt | date: 'shortTime' }}<br /><span class="text-muted">{{ a.requestedBy }}</span></td>
                <td><span class="badge text-bg-light border">{{ a.channel }}</span></td>
                <td>{{ a.counterparty }}</td>
                <td class="small">{{ a.description }}<br /><span class="text-muted">{{ a.externalRef }}</span></td>
                <td class="text-end fw-semibold" [class.text-success]="a.direction === 'IN'" [class.text-danger]="a.direction === 'OUT'">
                  {{ (a.direction === 'IN' ? a.amount : -a.amount) | crore: true }}
                </td>
                <td>
                  <span class="badge rounded-pill" [ngClass]="statusClass(a)">{{ a.status | titlecase }}</span>
                  @if (a.decidedBy) {
                    <div class="small text-muted">{{ a.decidedBy }} · {{ a.decidedAt | date: 'shortTime' }}</div>
                  }
                  @if (a.remarks) {
                    <div class="small text-muted">{{ a.remarks }}</div>
                  }
                </td>
                <td class="text-end text-nowrap">
                  @if (a.status === 'PENDING' && canDecide()) {
                    <input type="text" class="form-control form-control-sm d-inline-block me-2" style="width: 150px;" placeholder="Remarks" maxlength="500" [(ngModel)]="remarks[a.id]" />
                    <button class="btn btn-sm btn-success me-1" type="button" (click)="decide(a, true)">Approve</button>
                    <button class="btn btn-sm btn-outline-danger" type="button" (click)="decide(a, false)">Decline</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="text-center text-muted py-5">No approval requests on this date.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Approvals {
  readonly service = inject(ApprovalService);
  readonly ui = inject(UiStateService);
  private readonly auth = inject(AuthService);
  readonly remarks: Record<string, string> = {};

  readonly canDecide = computed(() => this.auth.hasPermission(ApiRoles.APPROVAL_DECIDE));
  readonly counts = computed(() => {
    const c = { PENDING: 0, APPROVED: 0, DECLINED: 0 };
    this.service.requests().forEach((a) => c[a.status]++);
    return c;
  });
  readonly approvedNet = computed(() =>
    this.service
      .requests()
      .filter((a) => a.status === 'APPROVED')
      .reduce((s, a) => s + (a.direction === 'IN' ? a.amount : -a.amount), 0),
  );

  constructor() {
    effect(() => {
      this.ui.refreshTick();
      this.ui.date();
      untracked(() => this.service.loadForDate());
    });
  }

  decide(a: ApprovalRequest, approve: boolean): void {
    this.service.decide(a.id, approve, this.remarks[a.id] || null).subscribe();
  }

  statusClass(a: ApprovalRequest): string {
    return a.status === 'APPROVED' ? 'text-bg-success-subtle text-success-emphasis'
      : a.status === 'DECLINED' ? 'text-bg-danger-subtle text-danger-emphasis'
      : 'text-bg-warning-subtle text-warning-emphasis';
  }
}
