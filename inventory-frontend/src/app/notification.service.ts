import { Injectable, Inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { apiUrl } from './api-url';

export type NotificationKind = 'repair' | 'assignment_request' | 'new_signup';

export interface Notification {
  kind: NotificationKind;
  id: number;
  issue: string | null;
  asset_type: string | null;
  brand: string | null;
  created_at?: string | null;
  /** Present for kind `repair` when API sends it */
  repair_status?: string | null;
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
  private readonly isBrowser: boolean;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    @Inject(PLATFORM_ID) platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  private storageKey(userId: number): string {
    return `inventrack:notif-dismissed:${userId}`;
  }

  private loadDismissedFromStorage(userId: number) {
    if (!this.isBrowser) return;
    try {
      const raw = sessionStorage.getItem(this.storageKey(userId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      for (const k of parsed) {
        if (typeof k === 'string' && k) this.dismissedKeys.add(k);
      }
    } catch {
      /* ignore corrupt storage */
    }
  }

  private persistDismissedToStorage() {
    if (!this.isBrowser || this.lastUserId == null) return;
    try {
      const keys = [...this.dismissedKeys].slice(-500);
      sessionStorage.setItem(this.storageKey(this.lastUserId), JSON.stringify(keys));
    } catch {
      /* quota / private mode */
    }
  }

  private rowKey(rawId: unknown, kind?: string): string | null {
    if (rawId == null || rawId === '') return null;
    let idStr: string;
    if (typeof rawId === 'bigint') idStr = rawId.toString();
    else {
      const n = Number(rawId);
      idStr = Number.isFinite(n) ? String(Math.trunc(n)) : String(rawId).trim();
    }
    if (!idStr) return null;
    const k =
      kind === 'assignment_request' ? 'ar' : kind === 'new_signup' ? 'ns' : 'repair';
    return `${k}:${idStr}`;
  }

  private applyDismissedFilter(rows: Notification[]): Notification[] {
    return rows.filter((n) => {
      const key = this.rowKey(n.id, n.kind);
      return key != null && !this.dismissedKeys.has(key);
    });
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
      if (uid != null) {
        this.loadDismissedFromStorage(uid);
      }
    }

    this.http.get<any[]>(this.notificationsUrl, this.auth.getAuthHeaders()).subscribe({
      next: (data) => {
        const mapped = (data || [])
          .map((n) => {
            const kind = (
              n.kind === 'assignment_request'
                ? 'assignment_request'
                : n.kind === 'new_signup'
                  ? 'new_signup'
                  : 'repair'
            ) as NotificationKind;
            const id = typeof n.id === 'number' ? n.id : Number(n.id) || n.id;
            return {
              kind,
              id,
              issue: n.issue ?? null,
              asset_type: n.asset_type ?? null,
              brand: n.brand ?? null,
              created_at: n.created_at ?? null,
              repair_status: n.repair_status ?? null,
              read: false,
            } as Notification;
          });
        this.notifications.set(this.applyDismissedFilter(mapped));
      },
      error: () => {
        this.notifications.set([]);
      },
    });
  }

  /** Dismiss everything currently shown (admin closed the panel or clicked away). */
  markPanelViewed() {
    for (const n of this.notifications()) {
      const k = this.rowKey(n.id, n.kind);
      if (k) this.dismissedKeys.add(k);
    }
    this.notifications.set([]);
    this.persistDismissedToStorage();
  }

  /** Dismiss a single row when admin opens it from the list. */
  dismissOne(n: Notification) {
    const k = this.rowKey(n.id, n.kind);
    if (!k) return;
    this.dismissedKeys.add(k);
    this.notifications.update((list) =>
      list.filter((row) => this.rowKey(row.id, row.kind) !== k),
    );
    this.persistDismissedToStorage();
  }

  /** @deprecated Use {@link markPanelViewed} */
  markAllRead() {
    this.markPanelViewed();
  }

  resetDismissed() {
    if (this.isBrowser && this.lastUserId != null) {
      try {
        sessionStorage.removeItem(this.storageKey(this.lastUserId));
      } catch {
        /* ignore */
      }
    }
    this.dismissedKeys.clear();
    this.lastUserId = null;
    this.notifications.set([]);
  }
}
