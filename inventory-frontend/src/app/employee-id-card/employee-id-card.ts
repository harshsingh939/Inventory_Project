import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
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
  profile: { name: string; employee_id: string; department: string } | null = null;

  /** Pending assignment requests submitted by this user */
  openRequests = 0;
  /** Active checkouts for this employee */
  assignedToYou = 0;
  /** Completed assignments returned from /me/assignments (capped by API, typically last 30) */
  completedCheckouts = 0;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private auth: AuthService,
    private router: Router,
    private employeeProfile: EmployeeProfileStatusService,
    @Inject(PLATFORM_ID) private platformId: object,
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
    }).subscribe({
      next: ({ users, me, mine }) => {
        const rows = Array.isArray(users) ? users : [];
        const row = rows[0];
        if (row?.name && row?.department) {
          this.profile = {
            name: String(row.name),
            employee_id: String(row.employee_id || ''),
            department: String(row.department),
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

  /**
   * Time-of-day greeting: morning / afternoon (day) / evening / night (late hours).
   */
  greetingPrefix(): string {
    if (!isPlatformBrowser(this.platformId)) return 'Hello';
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Good morning';
    if (h >= 12 && h < 17) return 'Good afternoon';
    if (h >= 17 && h < 22) return 'Good evening';
    return 'Good night';
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
}
