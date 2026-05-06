import { ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { defer, EMPTY, fromEvent, merge, of } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { apiUrl } from '../api-url';

@Component({
  selector: 'app-assignment-requests-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './assignment-requests-admin.html',
  styleUrl: './assignment-requests-admin.css',
})
export class AssignmentRequestsAdmin {
  private readonly api = apiUrl('assignment-requests');
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  rows: any[] = [];
  rejectNote: Record<number, string> = {};
  loading = false;
  fulfillingId: number | null = null;
  errorMsg = '';
  successMsg = '';

  constructor() {
    let hiddenAt = 0;
    merge(
      defer(() =>
        this.isAssignmentRequestsUrl(this.router.url) ? of(undefined) : EMPTY,
      ),
      this.router.events.pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        filter((e) => this.isAssignmentRequestsUrl(e.urlAfterRedirects)),
      ),
      fromEvent(document, 'visibilitychange').pipe(
        tap(() => {
          if (document.visibilityState === 'hidden') {
            hiddenAt = Date.now();
          }
        }),
        filter(() => document.visibilityState === 'visible'),
        filter(() => hiddenAt > 0 && Date.now() - hiddenAt > 1500),
        filter(() => this.isAssignmentRequestsUrl(this.router.url)),
      ),
    )
      .pipe(debounceTime(80), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  private isAssignmentRequestsUrl(raw: string): boolean {
    const path = (raw || '').split(/[?#]/)[0];
    return path === '/assignment-requests' || path.endsWith('/assignment-requests');
  }

  load() {
    this.loading = true;
    this.errorMsg = '';
    this.http.get<any[]>(`${this.api}/admin`).subscribe({
      next: (data) => {
        this.rows = Array.isArray(data) ? data : [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.message || 'Failed to load';
        this.cdr.detectChanges();
      },
    });
  }

  /** Mark ticket fulfilled only (no stock check; POST /admin/:id/fulfill-manual). */
  markAssigned(row: any) {
    const id = Number(row?.id);
    if (!Number.isFinite(id)) return;
    this.errorMsg = '';
    this.successMsg = '';
    this.fulfillingId = id;
    this.http.post<any>(`${this.api}/admin/${id}/fulfill-manual`, {}).subscribe({
      next: (res) => {
        this.fulfillingId = null;
        this.successMsg = res?.message || 'Assigned';
        this.load();
        this.cdr.detectChanges();
        setTimeout(() => {
          this.successMsg = '';
          this.cdr.detectChanges();
        }, 2500);
      },
      error: (err) => {
        this.fulfillingId = null;
        this.errorMsg = err.error?.message || 'Assign failed';
        this.cdr.detectChanges();
      },
    });
  }

  reject(row: any) {
    this.errorMsg = '';
    this.http.post<any>(`${this.api}/admin/${row.id}/reject`, { admin_note: this.rejectNote[row.id] || null }).subscribe({
      next: () => {
        this.successMsg = 'Rejected';
        this.load();
        this.cdr.detectChanges();
        setTimeout(() => {
          this.successMsg = '';
          this.cdr.detectChanges();
        }, 2500);
      },
      error: (err) => {
        this.errorMsg = err.error?.message || 'Reject failed';
        this.cdr.detectChanges();
      },
    });
  }
}
