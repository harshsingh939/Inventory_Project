import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { apiUrl } from './api-url';

/** Same-origin tabs: employee submits repair → admin tab refetches immediately */
export const REPAIR_BROADCAST_CHANNEL = 'inventtrack-repairs';

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

/**
 * Alerts = open repairs with id > per-admin watermark (new since baseline / acknowledge).
 * History = open repairs with id ≤ watermark (older backlog, still pending).
 * First visit: baseline watermark = max open id so existing backlog is history only.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  /** New items for badge + primary queue */
  private readonly newAlertsQueue = signal<Notification[]>([]);
  /** Older pending repairs (still open), newest first */
  private readonly historyRepairs = signal<Notification[]>([]);
  /** Max repair id in last full open list — for "dismiss all" */
  private lastOpenMaxId = 0;

  readonly notifications = computed(() => {
    const q = this.newAlertsQueue();
    return q.length ? [q[0]] : [];
  });

  readonly historyNotifications = computed(() => this.historyRepairs());

  /** Badge = new alerts only */
  readonly unreadCount = computed(() => this.newAlertsQueue().length);

  readonly historyCount = computed(() => this.historyRepairs().length);

  private lastUserId: number | null = null;
  private interval: ReturnType<typeof setInterval> | undefined;
  private bc: BroadcastChannel | undefined;
  private previousNewAlertIds = new Set<string>();
  private hasCompletedNotificationFetch = false;
  readonly repairAlertToast = signal<string | null>(null);
  private toastClearTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private http: HttpClient, private auth: AuthService) {}

  private watermarkKey(uid: number): string {
    return `inventrack_notif_watermark_${uid}`;
  }

  /** null = never baselined on this device */
  private readWatermark(uid: number): number | null {
    if (typeof localStorage === 'undefined') return 0;
    const raw = localStorage.getItem(this.watermarkKey(uid));
    if (raw === null) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  }

  private writeWatermark(uid: number, value: number): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(
      this.watermarkKey(uid),
      String(Math.max(0, Math.floor(value)))
    );
  }

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

  private isOpenRepair(n: any): boolean {
    const s = (n?.status ?? '').toString().trim().toLowerCase();
    if (!s) return true;
    const closed = new Set([
      'fixed',
      'completed',
      'complete',
      'closed',
      'cancelled',
      'canceled',
      'done',
      'resolved',
    ]);
    return !closed.has(s);
  }

  private sortQueueOldestFirst(rows: Notification[]): Notification[] {
    return [...rows].sort((a, b) => Number(a.id) - Number(b.id));
  }

  private attachRepairBroadcast() {
    if (typeof BroadcastChannel === 'undefined' || this.bc) return;
    this.bc = new BroadcastChannel(REPAIR_BROADCAST_CHANNEL);
    this.bc.onmessage = () => {
      if (this.auth.isLoggedIn() && this.auth.isAdmin()) {
        this.fetchNotifications();
      }
    };
  }

  private clearToastTimer() {
    if (this.toastClearTimer !== undefined) {
      clearTimeout(this.toastClearTimer);
      this.toastClearTimer = undefined;
    }
  }

  private flashRepairToast(message: string) {
    this.clearToastTimer();
    this.repairAlertToast.set(message);
    this.toastClearTimer = setTimeout(() => {
      this.repairAlertToast.set(null);
      this.toastClearTimer = undefined;
    }, 7000);
  }

  dismissRepairToast() {
    this.clearToastTimer();
    this.repairAlertToast.set(null);
  }

  startPolling() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    if (!this.auth.isLoggedIn() || !this.auth.isAdmin()) return;
    this.attachRepairBroadcast();
    this.fetchNotifications();
    this.interval = setInterval(() => this.fetchNotifications(), 2500);
  }

  stopPolling() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    if (this.bc) {
      this.bc.close();
      this.bc = undefined;
    }
    this.clearToastTimer();
    this.repairAlertToast.set(null);
  }

  fetchNotifications() {
    if (!this.auth.isLoggedIn() || !this.auth.isAdmin()) {
      this.newAlertsQueue.set([]);
      this.historyRepairs.set([]);
      return;
    }

    const profile = this.auth.getProfile();
    const uid = profile?.id ?? null;
    if (uid !== this.lastUserId) {
      this.lastUserId = uid;
      this.previousNewAlertIds = new Set();
      this.hasCompletedNotificationFetch = false;
    }

    if (uid == null) {
      this.newAlertsQueue.set([]);
      this.historyRepairs.set([]);
      return;
    }

    const url = apiUrl('notifications');
    this.http.get<any[]>(url, this.auth.getAuthHeaders()).subscribe({
      next: (data) => {
        const rows = Array.isArray(data) ? data : [];
        const visible = rows
          .filter((n) => this.isOpenRepair(n))
          .map((n) => this.normalizeRow(n));
        const sorted = this.sortQueueOldestFirst(visible);
        this.lastOpenMaxId = sorted.reduce(
          (m, r) => Math.max(m, Number(r.id)),
          0
        );

        let w = this.readWatermark(uid);

        if (w === null) {
          this.writeWatermark(uid, this.lastOpenMaxId);
          w = this.lastOpenMaxId;
          this.newAlertsQueue.set([]);
          this.historyRepairs.set(
            [...sorted]
              .sort((a, b) => Number(b.id) - Number(a.id))
              .slice(0, 12)
          );
          this.previousNewAlertIds = new Set();
          this.hasCompletedNotificationFetch = true;
          return;
        }

        const newAlerts = sorted.filter((r) => Number(r.id) > w);
        const history = sorted.filter((r) => Number(r.id) <= w);
        const newSorted = this.sortQueueOldestFirst(newAlerts);
        const historySorted = [...history]
          .sort((a, b) => Number(b.id) - Number(a.id))
          .slice(0, 12);

        const newIds = new Set(
          newSorted
            .map((n) => this.repairKey(n.id))
            .filter((k): k is string => k != null)
        );
        let newcomer: Notification | undefined;
        if (this.hasCompletedNotificationFetch) {
          for (const n of newSorted) {
            const k = this.repairKey(n.id);
            if (k == null || this.previousNewAlertIds.has(k)) continue;
            if (!newcomer || Number(n.id) > Number(newcomer.id)) {
              newcomer = n;
            }
          }
        }
        this.previousNewAlertIds = newIds;
        this.hasCompletedNotificationFetch = true;

        if (newcomer) {
          const preview = [newcomer.asset_type, newcomer.brand]
            .filter(Boolean)
            .join(' — ');
          const issueHint = newcomer.issue
            ? newcomer.issue.length > 80
              ? `${newcomer.issue.slice(0, 80)}…`
              : newcomer.issue
            : '';
          this.flashRepairToast(
            preview
              ? `New repair: ${preview}${issueHint ? ` — ${issueHint}` : ''}`
              : issueHint
              ? `New repair request — ${issueHint}`
              : 'New repair request received'
          );
        }

        this.newAlertsQueue.set(newSorted);
        this.historyRepairs.set(historySorted);
      },
      error: (err) => {
        console.warn(
          '[InvenTrack] Repair notifications failed:',
          err?.status,
          err?.error ?? err?.message
        );
        this.newAlertsQueue.set([]);
        this.historyRepairs.set([]);
      },
    });
  }

  /** Advance watermark past current head — moves it to history */
  dismissCurrent() {
    const q = this.newAlertsQueue();
    if (!q.length) return;
    const uid = this.auth.getProfile()?.id;
    if (uid == null) return;
    const headId = Number(q[0].id);
    const w = this.readWatermark(uid);
    if (w !== null) {
      this.writeWatermark(uid, Math.max(w, headId));
    }
    this.fetchNotifications();
  }

  /** Clear badge: treat every currently open repair as seen */
  markAllRead() {
    const uid = this.auth.getProfile()?.id;
    if (uid == null) return;
    const w = this.readWatermark(uid) ?? 0;
    this.writeWatermark(uid, Math.max(w, this.lastOpenMaxId));
    this.fetchNotifications();
  }

  resetDismissed() {
    this.lastUserId = null;
    this.newAlertsQueue.set([]);
    this.historyRepairs.set([]);
    this.previousNewAlertIds = new Set();
    this.hasCompletedNotificationFetch = false;
    this.lastOpenMaxId = 0;
    this.clearToastTimer();
    this.repairAlertToast.set(null);
  }
}
