import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { apiUrl } from './api-url';

export interface Notification {
  id: number;
  issue: string;
  asset_type: string;
  brand: string;
  created_at?: string;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly notificationsUrl = apiUrl('notifications');
  notifications = signal<Notification[]>([]);
  /** Same as visible list length — avoids badge vs list mismatch */
  readonly unreadCount = computed(() => this.notifications().length);
  /** Dismissed repair keys (string) so API number/string/BigInt ids still match */
  private dismissedKeys = new Set<string>();
  private lastUserId: number | null = null;
  private interval: any;

  constructor(private http: HttpClient, private auth: AuthService) {}

  private repairKey(raw: unknown): string | null {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'bigint') return raw.toString();
    const n = Number(raw);
    if (Number.isFinite(n)) return String(Math.trunc(n));
    const s = String(raw).trim();
    return s.length ? s : null;
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
          .filter((n) => {
            const k = this.repairKey(n.id);
            return k != null && !this.dismissedKeys.has(k);
          })
          .map((n) => ({
            ...n,
            id: typeof n.id === 'number' ? n.id : Number(n.id) || n.id,
            created_at: n.created_at ?? '',
            read: false,
          }));
        this.notifications.set(visible);
      },
      error: () => {
        this.notifications.set([]);
      }
    });
  }

  /** Call when admin closes the bell — hidden until new repair ids appear */
  markAllRead() {
    for (const n of this.notifications()) {
      const k = this.repairKey(n.id);
      if (k) this.dismissedKeys.add(k);
    }
    this.notifications.set([]);
  }

  /** Call on logout so the next login does not inherit dismissed ids */
  resetDismissed() {
    this.dismissedKeys.clear();
    this.lastUserId = null;
    this.notifications.set([]);
  }
}