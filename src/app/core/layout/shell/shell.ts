import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { timer } from 'rxjs';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';
import { NotificationService } from '../../services/notification.service';
import { UiStateService } from '../../services/ui-state.service';
import { Toasts } from '../../../shared/components/toasts/toasts';

const NOTIFICATION_POLL_MS = 60_000;

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, Sidebar, Topbar, Toasts],
  templateUrl: './shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  constructor() {
    const notifications = inject(NotificationService);
    inject(UiStateService).loadBusinessDate();
    timer(0, NOTIFICATION_POLL_MS)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => notifications.load());
  }
}
