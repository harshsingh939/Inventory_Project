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
  selector: 'app-repair-work-vendor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './repair-work-vendor.html',
  styleUrls: ['../assignment-requests-admin/assignment-requests-admin.css', '../repair-requests-admin/repair-requests-admin.css'],
})
export class RepairWorkVendor {
  private readonly api = apiUrl('repairs');
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  workRows: any[] = [];
  loading = false;
  submittingId: number | null = null;
  reviewNotesById: Record<number, string> = {};
  reviewCostById: Record<number, string> = {};
  errorMsg = '';
  successMsg = '';

  constructor() {
    let hiddenAt = 0;
    merge(
      defer(() => (this.isWorkUrl(this.router.url) ? of(undefined) : EMPTY)),
      this.router.events.pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        filter((e) => this.isWorkUrl(e.urlAfterRedirects)),
      ),
      fromEvent(document, 'visibilitychange').pipe(
        tap(() => {
          if (document.visibilityState === 'hidden') hiddenAt = Date.now();
        }),
        filter(() => document.visibilityState === 'visible'),
        filter(() => hiddenAt > 0 && Date.now() - hiddenAt > 1500),
        filter(() => this.isWorkUrl(this.router.url)),
      ),
    )
      .pipe(debounceTime(80), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  private isWorkUrl(raw: string): boolean {
    const path = (raw || '').split(/[?#]/)[0];
    return path === '/repair-work' || path.endsWith('/repair-work');
  }

  load() {
    this.loading = true;
    this.errorMsg = '';
    this.http.get<any[]>(`${this.api}`).subscribe({
      next: (data) => {
        const source = Array.isArray(data) ? data : [];
        this.workRows = source.filter((r) => {
          const s = String(r?.status || '').trim().toLowerCase();
          return s === 'under repair' || s === 'withauthority' || s === 'in progress';
        });
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.workRows = [];
        this.loading = false;
        this.errorMsg = err.error?.message || 'Failed to load work queue';
        this.cdr.detectChanges();
      },
    });
  }

  submitForAdminReview(row: any) {
    const id = Number(row?.id);
    if (!Number.isFinite(id)) return;
    const notes = String(this.reviewNotesById[id] ?? '').trim();
    const rawCost = String(this.reviewCostById[id] ?? '').trim();
    if (!notes) {
      this.errorMsg = 'Fix details are required before submitting to admin.';
      this.cdr.detectChanges();
      return;
    }
    if (rawCost !== '') {
      const n = Number(rawCost);
      if (!Number.isFinite(n) || n < 0) {
        this.errorMsg = 'Enter a valid repair cost.';
        this.cdr.detectChanges();
        return;
      }
    }

    this.errorMsg = '';
    this.successMsg = '';
    this.submittingId = id;
    const payload: Record<string, unknown> = {
      status: 'ReviewPending',
      repair_notes: notes,
    };
    if (rawCost !== '') payload['repair_cost'] = Number(rawCost);

    this.http.put<any>(`${this.api}/update/${id}`, payload).subscribe({
      next: () => {
        this.submittingId = null;
        this.reviewNotesById[id] = '';
        this.reviewCostById[id] = '';
        this.successMsg = 'Submitted to admin for review ✅';
        this.load();
        this.cdr.detectChanges();
        setTimeout(() => {
          this.successMsg = '';
          this.cdr.detectChanges();
        }, 2500);
      },
      error: (err) => {
        this.submittingId = null;
        this.errorMsg = err.error?.message || 'Failed to submit review';
        this.cdr.detectChanges();
      },
    });
  }
}
