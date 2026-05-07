import { ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
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
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  rows: any[] = [];
  rejectNote: Record<number, string> = {};
  loading = false;
  fulfillingId: number | null = null;
  errorMsg = '';
  successMsg = '';

  /** Deep-link highlight from ?requestId= (e.g. after login from email) */
  highlightRequestId: number | null = null;

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
      .subscribe(() => {
        this.readHighlightQuery();
        this.load();
      });
  }

  private readHighlightQuery(): void {
    const q = this.route.snapshot.queryParamMap;
    const rid = Number(q.get('requestId'));
    this.highlightRequestId = Number.isFinite(rid) && rid > 0 ? rid : null;
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
        this.scrollToHighlight();
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.message || 'Failed to load';
        this.cdr.detectChanges();
      },
    });
  }

  private scrollToHighlight(): void {
    const id = this.highlightRequestId;
    if (!id) return;
    queueMicrotask(() => {
      document.getElementById(`assign-req-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  /** Auto-match stock, assign to requester, mark Fulfilled (POST /admin/:id/fulfill). */
  markAssigned(row: any) {
    const id = Number(row?.id);
    if (!Number.isFinite(id)) return;
    this.errorMsg = '';
    this.successMsg = '';
    this.fulfillingId = id;
    this.http.post<any>(`${this.api}/admin/${id}/fulfill`, {}).subscribe({
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
