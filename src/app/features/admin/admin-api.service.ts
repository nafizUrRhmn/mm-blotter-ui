import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/api/api.config';

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
}

export interface AuditLog {
  id: string;
  occurredAt: string;
  actor: string;
  action: string;
  targetType?: string;
  targetId?: string;
  outcome?: string;
  ipAddress?: string;
  details?: Record<string, unknown>;
}

/**
 * MM Blotter's own admin data: the business audit log. Users, roles and menus are administered
 * in ACS (MM Blotter is the ACS tenant MM-BLOTTER).
 */
@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly root = inject(API_BASE_URL);

  auditLogs(
    filter: { actor?: string; action?: string },
    page = 0,
    size = 50,
  ): Observable<Page<AuditLog>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (filter.actor) params = params.set('actor', filter.actor);
    if (filter.action) params = params.set('action', filter.action);
    return this.http.get<Page<AuditLog>>(`${this.root}/audit-logs`, { params });
  }
}
