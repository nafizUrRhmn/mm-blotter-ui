import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpContext } from '@angular/common/http';
import { NotificationService } from '../../../core/services/notification.service';
import { AppNotification } from '../../../core/models/notification.model';
import { AuthService } from '../../../core/services/auth.service';
import { API_BASE_URL, SKIP_ERROR_TOAST } from '../../../core/api/api.config';
import { ApprovalRequest, ApprovalService } from '../../../features/approvals/approval.service';
import { CrorePipe } from '../../pipes/crore.pipe';
import { Icon } from '../icon/icon';
import { ApiRoles } from '../../../core/auth/api-roles';

interface Presence {
  username: string;
  name: string;
  initials: string;
  lastSeen: string;
}

type Tab = 'notifications' | 'approvals' | 'active';

/**
 * Notification drawer (BRS §1.11): changes made by users, approval requests with Approve /
 * Decline, and active users / viewers.
 */
@Component({
  selector: 'app-notification-panel',
  standalone: true,
  imports: [CommonModule, Icon, CrorePipe],
  templateUrl: './notification-panel.html',
  styleUrl: './notification-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationPanel {
  private readonly notificationService = inject(NotificationService);
  private readonly approvals = inject(ApprovalService);
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly notifications = this.notificationService.notifications;
  readonly unreadCount = this.notificationService.unreadCount;
  readonly pending = this.approvals.pending;
  readonly active = signal<Presence[]>([]);
  readonly open = signal(false);
  readonly tab = signal<Tab>('notifications');

  readonly canViewApprovals = computed(() => this.auth.hasPermission(ApiRoles.APPROVAL_VIEW));
  readonly canDecide = computed(() => this.auth.hasPermission(ApiRoles.APPROVAL_DECIDE));
  readonly badgeCount = computed(() => this.unreadCount() + (this.canViewApprovals() ? this.pending().length : 0));

  constructor() {
    // Initial counts for the bell badge; the drawer refreshes on every open.
    queueMicrotask(() => this.refreshSide());
  }

  toggle(): void {
    this.open.update((v) => !v);
    if (this.open()) this.refreshSide();
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
    this.refreshSide();
  }

  select(notification: AppNotification): void {
    if (!notification.read) {
      this.notificationService.markAsRead(notification.id);
    }
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  clearAll(): void {
    this.notificationService.clearAll();
  }

  decide(a: ApprovalRequest, approve: boolean): void {
    this.approvals.decide(a.id, approve).subscribe();
  }

  private refreshSide(): void {
    if (this.canViewApprovals()) this.approvals.loadPending();
    this.http
      .get<Presence[]>(`${this.api}/presence`, { context: new HttpContext().set(SKIP_ERROR_TOAST, true) })
      .subscribe({ next: (list) => this.active.set(list), error: () => undefined });
  }

  levelIcon(level: AppNotification['level']): string {
    switch (level) {
      case 'critical':
        return 'x';
      case 'warning':
        return 'clock';
      case 'success':
        return 'check-square';
      default:
        return 'bell';
    }
  }

  levelBg(level: AppNotification['level']): string {
    switch (level) {
      case 'critical':
        return 'danger-subtle text-danger-emphasis';
      case 'warning':
        return 'warning-subtle text-warning-emphasis';
      case 'success':
        return 'success-subtle text-success-emphasis';
      default:
        return 'info-subtle text-info-emphasis';
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }
}
