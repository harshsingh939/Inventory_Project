import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { apiUrl } from '../api-url';
import { AuthService } from '../auth.service';
import { EmployeeProfileStatusService } from '../employee-profile-status.service';

@Component({
  selector: 'app-employee-id-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './employee-id-card.html',
  styleUrl: './employee-id-card.css',
})
export class EmployeeIdCard implements OnInit {
  private readonly usersUrl = apiUrl('users');
  private readonly apiBase = apiUrl('');

  isLoading = true;
  errorMsg = '';
  /** First linked directory row for this login, if any */
  profile: { name: string; employee_id: string; department: string; sub_role: string } | null = null;

  /** Pending assignment requests submitted by this user */
  openRequests = 0;
  /** Active checkouts for this employee */
  assignedToYou = 0;
  /** Completed assignments returned from /me/assignments (capped by API, typically last 30) */
  completedCheckouts = 0;
  /** All non-disposed asset rows (for headline count on activity card) */
  totalAssetsCount = 0;
  /** Last 7 days (oldest → today): counts + bar heights % */
  weekLabels: string[] = [];
  requestWeekPct: number[] = [];
  repairWeekPct: number[] = [];
  assetWeekPct: number[] = [];

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private auth: AuthService,
    private router: Router,
    private employeeProfile: EmployeeProfileStatusService,
  ) {}

  ngOnInit() {
    if (this.auth.isAdmin()) {
      void this.router.navigate(['/users']);
      return;
    }
    if (this.auth.isRepairAuthority()) {
      void this.router.navigate(['/repair-requests']);
      return;
    }
    if (!this.auth.isLoggedIn()) {
      void this.router.navigate(['/login']);
      return;
    }
    this.loadProfile();
  }

  private loadProfile() {
    this.isLoading = true;
    this.errorMsg = '';
    forkJoin({
      users: this.http.get<any[]>(this.usersUrl).pipe(catchError(() => of([]))),
      me: this.http.get<any>(`${this.apiBase}/me/assignments`).pipe(catchError(() => of(null))),
      mine: this.http.get<any[]>(`${this.apiBase}/assignment-requests/mine`).pipe(catchError(() => of([]))),
      repairs: this.http.get<any[]>(`${this.apiBase}/repairs`).pipe(catchError(() => of([]))),
      assets: this.http.get<any[]>(`${this.apiBase}/assets`).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ users, me, mine, repairs, assets }) => {
        const rows = Array.isArray(users) ? users : [];
        const row = rows[0];
        if (row?.name && row?.department) {
          this.profile = {
            name: String(row.name),
            employee_id: String(row.employee_id || ''),
            department: String(row.department),
            sub_role: String(row.sub_role ?? '').trim(),
          };
        } else {
          this.profile = null;
        }

        const active = me ? ((me as { active?: unknown[] })?.active ?? []) : [];
        const history = me ? ((me as { history?: unknown[] })?.history ?? []) : [];
        const actives = Array.isArray(active) ? active : [];
        const hist = Array.isArray(history) ? history : [];
        this.assignedToYou = actives.length;
        this.completedCheckouts = hist.filter(
          (h) => String((h as { status?: string })?.status || '').toLowerCase() === 'completed',
        ).length;

        const reqRows = Array.isArray(mine) ? mine : [];
        this.openRequests = reqRows.filter(
          (r) => String((r as { status?: string })?.status || '').toLowerCase() === 'pending',
        ).length;

        const assetRows = Array.isArray(assets) ? assets : [];
        this.totalAssetsCount = assetRows.length;

        this.syncActivityCharts(reqRows, Array.isArray(repairs) ? repairs : [], assetRows);

        this.isLoading = false;
        this.employeeProfile.refresh().subscribe({ error: () => {} });
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMsg = 'Could not load your profile.';
        this.isLoading = false;
        this.profile = null;
        this.openRequests = 0;
        this.assignedToYou = 0;
        this.completedCheckouts = 0;
        this.totalAssetsCount = 0;
        this.clearActivityCharts();
        this.employeeProfile.refresh().subscribe({ error: () => {} });
        this.cdr.detectChanges();
      },
    });
  }

  initials(name: string): string {
    const parts = String(name || '')
      .trim()
      .split(/\s+/);
    if (!parts[0]) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  firstName(): string {
    const n = String(this.profile?.name || '').trim();
    if (!n) return 'there';
    return n.split(/\s+/)[0] || n;
  }

  roleDisplay(): string {
    const p = this.auth.getProfile();
    const raw = String((p as { role?: string } | null)?.role || 'user')
      .trim()
      .replace(/_/g, ' ');
    if (!raw) return 'Team member';
    return raw.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  deptBadge(): string {
    const d = String(this.profile?.department || '').trim();
    return d ? `${d} Dept` : 'Dept';
  }

  /** Job designation from Team registration sub-role */
  designationDisplay(): string {
    const s = String(this.profile?.sub_role || '').trim();
    return s || '—';
  }

  openRequestsDisplay(): string {
    return String(this.openRequests);
  }

  openRequestsBadge(): string {
    return this.openRequests > 0 ? 'Pending' : '—';
  }

  assignedBadge(): string {
    if (this.assignedToYou > 0) return `+${this.assignedToYou}`;
    return '—';
  }

  completedBadge(): string {
    return this.completedCheckouts > 0 ? 'Yours' : '—';
  }

  private clearActivityCharts(): void {
    this.weekLabels = [];
    this.requestWeekPct = [];
    this.repairWeekPct = [];
    this.assetWeekPct = [];
  }

  /** Rolling 7-day window ending today (local); labels + midnight keys for bucketing */
  private weekBucketMeta(): { labels: string[]; keys: number[] } {
    const labels: string[] = [];
    const keys: number[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      keys.push(d.getTime());
      labels.push(
        d.toLocaleDateString(undefined, {
          weekday: 'short',
        }),
      );
    }
    return { labels, keys };
  }

  private pickRowDate(row: unknown, fields: string[]): Date | null {
    if (!row || typeof row !== 'object') return null;
    const o = row as Record<string, unknown>;
    for (const f of fields) {
      const v = o[f];
      if (v == null || v === '') continue;
      const d = new Date(String(v));
      if (!Number.isNaN(d.getTime())) return d;
    }
    return null;
  }

  private countsForKeys(rows: unknown[], fields: string[], keys: number[]): number[] {
    const counts = keys.map(() => 0);
    for (const row of rows) {
      const t = this.pickRowDate(row, fields);
      if (!t) continue;
      t.setHours(0, 0, 0, 0);
      const ix = keys.indexOf(t.getTime());
      if (ix >= 0) counts[ix]++;
    }
    return counts;
  }

  private countsToHeights(counts: number[]): number[] {
    const mx = Math.max(...counts, 1);
    return counts.map((c) => 12 + (c / mx) * 86);
  }

  private syncActivityCharts(requestRows: unknown[], repairRows: unknown[], assetRows: unknown[]): void {
    const { labels, keys } = this.weekBucketMeta();
    this.weekLabels = labels;
    const reqC = this.countsForKeys(requestRows, ['created_at', 'createdAt'], keys);
    const repC = this.countsForKeys(repairRows, ['reported_at', 'created_at', 'createdAt'], keys);
    const astC = this.countsForKeys(assetRows, ['created_at', 'createdAt'], keys);
    this.requestWeekPct = this.countsToHeights(reqC);
    this.repairWeekPct = this.countsToHeights(repC);
    this.assetWeekPct = this.countsToHeights(astC);
  }
}
