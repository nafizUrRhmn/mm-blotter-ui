import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { API_BASE_URL, SKIP_ERROR_TOAST } from '../api/api.config';
import { AppNotification, NotificationLevel } from '../models/notification.model';

interface NotificationDto {
  id: string;
  title: string;
  message: string;
  level: NotificationLevel;
  createdAt: string;
  read: boolean;
  link?: string;
}

/**
 * The user's notification feed (CRR breaches, new deals, forecasts awaiting approval…),
 * produced server-side by Kafka consumers. Refreshed by polling from the shell.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly items = signal<NotificationDto[]>([]);

  readonly notifications = computed<AppNotification[]>(() =>
    this.items().map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      level: n.level,
      timestamp: relativeTime(n.createdAt),
      read: n.read,
    })),
  );
  readonly unreadCount = computed(() => this.items().filter((n) => !n.read).length);

  load(): void {
    // Background poll: a transient failure should not pop a toast every minute.
    this.http
      .get<NotificationDto[]>(`${this.api}/notifications`, { context: new HttpContext().set(SKIP_ERROR_TOAST, true) })
      .subscribe({ next: (list) => this.items.set(list), error: () => undefined });
  }

  markAsRead(id: string): void {
    this.items.update((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    this.http.patch(`${this.api}/notifications/${id}/read`, null).subscribe({ error: () => this.load() });
  }

  markAllAsRead(): void {
    this.items.update((list) => list.map((n) => ({ ...n, read: true })));
    this.http.post(`${this.api}/notifications/read-all`, null).subscribe({ error: () => this.load() });
  }

  clearAll(): void {
    this.items.set([]);
    this.http.post(`${this.api}/notifications/dismiss-all`, null).subscribe({ error: () => this.load() });
  }

  reset(): void {
    this.items.set([]);
  }
}

function relativeTime(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}
