import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { apiUrl } from './api-url';

export type NotificationKind = 'repair' | 'assignment_request';

export interface Notification {
  kind: NotificationKind;
  id: number;
  issue: string | null;
  asset_type: string | null;
  brand: string | null;
  created_at?: string | null;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly notificationsUrl = apiUrl('notifications');
  notifications = signal<Notification[]>([]);
  readonly unreadCount = computed(() => this.notifications().length);
  private dismissedKeys = new Set<string>();
  private lastUserId: number | null = null;
  private interval: ReturnType<typeof setInterval> | undefined;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
  ) {}

  private rowKey(rawId: unknown, kind?: string): string | null {
    if (rawId == null || rawId === '') return null;
    let idStr: string;
    if (typeof rawId === 'bigint') idStr = rawId.toString();
    else {
      const n = Number(rawId);
      idStr = Number.isFinite(n) ? String(Math.trunc(n)) : String(rawId).trim();
    }
    if (!idStr) return null;
    const k = kind === 'assignment_request' ? 'ar' : 'repair';
    return `${k}:${idStr}`;
  }

  startPolling() {
    this.stopPolling();
    if (!this.auth.isLoggedIn() || !this.auth.isAdmin()) return;
    this.fetchNotifications();
    this.interval = setInterval(() => {
      this.fetchNotifications();
    }, 5000);
  }

  stopPolling() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  fetchNotifications() {
    if (!this.auth.isLoggedIn() || !this.auth.isAdmin()) {
      this.notifications.set([]);
      return;
    }

    const profile = this.auth.getProfile();
    const uid = profile?.id ?? null;
    if (uid !== this.lastUserId) {
      this.dismissedKeys.clear();
      this.lastUserId = uid;
    }

    this.http.get<any[]>(this.notificationsUrl, this.auth.getAuthHeaders()).subscribe({
      next: (data) => {
        const visible = (data || [])
          .map((n) => {
            const kind = (n.kind === 'assignment_request' ? 'assignment_request' : 'repair') as NotificationKind;
            const id = typeof n.id === 'number' ? n.id : Number(n.id) || n.id;
            return {
              kind,
              id,
              issue: n.issue ?? null,
              asset_type: n.asset_type ?? null,
              brand: n.brand ?? null,
              created_at: n.created_at ?? null,
              read: false,
            } as Notification;
          })
          .filter((n) => {
            const key = this.rowKey(n.id, n.kind);
            return key != null && !this.dismissedKeys.has(key);
          });
        this.notifications.set(visible);
      },
      error: () => {
        this.notifications.set([]);
      },
    });
  }

  markAllRead() {
    for (const n of this.notifications()) {
      const k = this.rowKey(n.id, n.kind);
      if (k) this.dismissedKeys.add(k);
    }
    this.notifications.set([]);
  }

  resetDismissed() {
    this.dismissedKeys.clear();
    this.lastUserId = null;
    this.notifications.set([]);
  }
}
