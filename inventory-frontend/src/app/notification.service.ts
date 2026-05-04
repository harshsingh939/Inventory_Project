import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { apiUrl } from './api-url';

export interface Notification {
  id: number;
  issue: string;
  asset_type: string;
  brand: string;
  /** Present when API sends it — fixed repairs must never notify */
  status?: string;
  created_at?: string;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly notificationsUrl = apiUrl('notifications');
  /** Full pending queue (newest from API, then sorted oldest-first for fair handling). */
  private readonly pendingQueue = signal<Notification[]>([]);
  /** Only the head of the queue — admin panel shows one repair at a time. */
  readonly notifications = computed(() => {
    const q = this.pendingQueue();
    return q.length ? [q[0]] : [];
  });
  /** Total repairs waiting in queue (same as badge). */
  readonly unreadCount = computed(() => this.pendingQueue().length);
  /** Dismissed repair keys (string) so API number/string/BigInt ids still match */
  private dismissedKeys = new Set<string>();
  private lastUserId: number | null = null;
  private interval: ReturnType<typeof setInterval> | undefined;

  constructor(private http: HttpClient, private auth: AuthService) {}

  private repairKey(raw: unknown): string | null {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'bigint') return raw.toString();
    const n = Number(raw);
    if (Number.isFinite(n)) return String(Math.trunc(n));
    const s = String(raw).trim();
    return s.length ? s : null;
  }

  private normalizeRow(n: any): Notification {
    return {
      ...n,
      id: typeof n.id === 'number' ? n.id : Number(n.id) || n.id,
      status: n.status,
      created_at: n.created_at ?? '',
      read: false,
    };
  }

  /** Match server: only Pending / In Progress (plus null/blank legacy rows). */
  private isOpenRepair(n: any): boolean {
    const s = (n?.status ?? '').toString().trim().toLowerCase();
    if (!s) return true;
    return s === 'pending' || s === 'in progress';
  }

  /** Oldest repair first so multiple employees are handled in request order. */
  private sortQueueOldestFirst(rows: Notification[]): Notification[] {
    return [...rows].sort((a, b) => Number(a.id) - Number(b.id));
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
      this.pendingQueue.set([]);
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
          .filter((n) => this.isOpenRepair(n))
          .filter((n) => {
            const k = this.repairKey(n.id);
            return k != null && !this.dismissedKeys.has(k);
          })
          .map((n) => this.normalizeRow(n));
        this.pendingQueue.set(this.sortQueueOldestFirst(visible));
      },
      error: () => {
        this.pendingQueue.set([]);
      },
    });
  }

  /** Remove the current (first) repair from the queue so the next one appears. */
  dismissCurrent() {
    const q = this.pendingQueue();
    if (!q.length) return;
    const k = this.repairKey(q[0].id);
    if (k) this.dismissedKeys.add(k);
    this.pendingQueue.set(q.slice(1));
  }

  /** Clear entire queue (e.g. before opening Repairs list). */
  markAllRead() {
    for (const n of this.pendingQueue()) {
      const k = this.repairKey(n.id);
      if (k) this.dismissedKeys.add(k);
    }
    this.pendingQueue.set([]);
  }

  /** Call on logout so the next login does not inherit dismissed ids */
  resetDismissed() {
    this.dismissedKeys.clear();
    this.lastUserId = null;
    this.pendingQueue.set([]);
  }
}
