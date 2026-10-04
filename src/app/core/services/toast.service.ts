import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  tone: 'danger' | 'success' | 'info';
}

let nextId = 1;

/** Transient, app-wide messages (API failures, confirmations). Rendered by `<app-toasts>`. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastsSignal = signal<Toast[]>([]);
  readonly toasts = this.toastsSignal.asReadonly();

  error(message: string): void {
    this.push(message, 'danger');
  }

  success(message: string): void {
    this.push(message, 'success');
  }

  dismiss(id: number): void {
    this.toastsSignal.update((list) => list.filter((t) => t.id !== id));
  }

  private push(message: string, tone: Toast['tone']): void {
    // Collapse identical messages fired in a burst (e.g. several failing requests on one page).
    if (this.toastsSignal().some((t) => t.message === message)) return;
    const toast: Toast = { id: nextId++, message, tone };
    this.toastsSignal.update((list) => [...list, toast].slice(-4));
    setTimeout(() => this.dismiss(toast.id), 6000);
  }
}
