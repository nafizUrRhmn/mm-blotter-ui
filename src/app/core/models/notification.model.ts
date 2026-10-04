export type NotificationLevel = 'info' | 'warning' | 'success' | 'critical';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  level: NotificationLevel;
  timestamp: string;
  read: boolean;
}
