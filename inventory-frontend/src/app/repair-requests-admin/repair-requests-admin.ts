import { ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { defer, EMPTY, fromEvent, merge, of } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { apiUrl } from '../api-url';

@Component({
  selector: 'app-repair-requests-admin',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './repair-requests-admin.html',
  styleUrls: ['../assignment-requests-admin/assignment-requests-admin.css', './repair-requests-admin.css'],
})
export class RepairRequestsAdmin {
  private readonly api = apiUrl('repairs');
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  rows: any[] = [];
  loading = false;
  approvingId: number | null = null;
  errorMsg = '';
  successMsg = '';

  constructor() {
    let hiddenAt = 0;
    merge(
      defer(() => (this.isRepairRequestsUrl(this.router.url) ? of(undefined) : EMPTY)),
      this.router.events.pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        filter((e) => this.isRepairRequestsUrl(e.urlAfterRedirects)),
      ),
      fromEvent(document, 'visibilitychange').pipe(
        tap(() => {
          if (document.visibilityState === 'hidden') hiddenAt = Date.now();
        }),
        filter(() => document.visibilityState === 'visible'),
        filter(() => hiddenAt > 0 && Date.now() - hiddenAt > 1500),
        filter(() => this.isRepairRequestsUrl(this.router.url)),
      ),
    )
      .pipe(debounceTime(80), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  private isRepairRequestsUrl(raw: string): boolean {
    const path = (raw || '').split(/[?#]/)[0];
    return path === '/repair-requests' || path.endsWith('/repair-requests');
  }

  load() {
    this.loading = true;
    this.errorMsg = '';
    this.http.get<any[]>(`${this.api}/admin/requests`).subscribe({
      next: (data) => {
        this.rows = Array.isArray(data) ? data : [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.rows = [];
        this.loading = false;
        this.errorMsg = err.error?.message || 'Failed to load repair requests';
        this.cdr.detectChanges();
      },
    });
  }

  approve(row: any) {
    const id = Number(row?.id);
    if (!Number.isFinite(id)) return;
    this.errorMsg = '';
    this.successMsg = '';
    this.approvingId = id;
    this.http.post<any>(`${this.api}/admin/${id}/approve`, {}).subscribe({
      next: (res) => {
        this.approvingId = null;
        this.successMsg = res?.message || 'Approved';
        this.load();
        this.cdr.detectChanges();
        setTimeout(() => {
          this.successMsg = '';
          this.cdr.detectChanges();
        }, 2500);
      },
      error: (err) => {
        this.approvingId = null;
        this.errorMsg = err.error?.message || 'Approve failed';
        this.cdr.detectChanges();
      },
    });
  }
}
