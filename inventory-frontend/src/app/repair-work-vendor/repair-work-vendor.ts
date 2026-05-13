import { ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { defer, EMPTY, fromEvent, merge, of } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { apiUrl } from '../api-url';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-repair-work-vendor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './repair-work-vendor.html',
  styleUrls: ['../assignment-requests-admin/assignment-requests-admin.css', '../repair-requests-admin/repair-requests-admin.css'],
  styles: [
    `
      /* Single wide column — card uses horizontal space instead of a narrow 420px track */
      .repair-work-vendor .assign-board {
        grid-template-columns: 1fr;
        justify-items: stretch;
      }
      .repair-work-vendor .req-ticket {
        width: 100%;
        max-width: min(960px, 100%);
        margin-inline: auto;
        padding: 0 14px 14px 18px;
        box-sizing: border-box;
      }
      .repair-work-vendor .req-ticket__mast {
        padding-top: 10px;
        margin-bottom: 10px;
      }
      .repair-work-vendor .req-ticket__perforate {
        margin-bottom: 10px;
      }
      .repair-work-vendor .req-field {
        padding: 8px 10px;
        gap: 3px;
      }
      .repair-work-vendor .req-ticket__grid {
        gap: 10px 16px;
      }
      .repair-work-vendor .req-ticket__actions {
        margin-top: 12px;
        padding: 12px;
      }
      .rw-fix-textarea {
        min-height: 3.25rem;
        max-height: 6rem;
        resize: vertical;
        line-height: 1.4;
      }
      .rw-bill-input {
        padding: 8px 0;
        font-size: 0.8125rem;
        color: #e2e8f0;
        background: transparent;
        border: none;
        border-bottom: 1px solid rgba(51, 65, 85, 0.9);
        width: 100%;
      }
      .rw-bill-hint {
        margin: 6px 0 0;
        font-size: 0.75rem;
        color: #94a3b8;
      }
      .rw-bill-hint--muted {
        margin-top: 2px;
        opacity: 0.9;
      }
      @media (max-width: 560px) {
        .repair-work-vendor .req-ticket {
          max-width: 100%;
        }
      }
    `,
  ],
})
export class RepairWorkVendor {
  private readonly api = apiUrl('repairs');
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  workRows: any[] = [];
  loading = false;
  submittingId: number | null = null;
  reviewNotesById: Record<number, string> = {};
  reviewCostById: Record<number, string> = {};
  /** Optional invoice / bill per repair row (multipart field `repair_bill`) */
  billFileById: Record<number, File | undefined> = {};
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

  onBillSelected(id: number, ev: Event) {
    const el = ev.target as HTMLInputElement;
    const f = el.files?.[0];
    if (f) {
      this.billFileById[id] = f;
    } else {
      delete this.billFileById[id];
    }
    this.cdr.detectChanges();
  }

  billName(id: number): string {
    return this.billFileById[id]?.name || '';
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

    const file = this.billFileById[id];
    const headers = this.auth.getAuthHeaders();

    if (file) {
      const form = new FormData();
      form.append('status', 'ReviewPending');
      form.append('repair_notes', notes);
      if (rawCost !== '') form.append('repair_cost', String(Number(rawCost)));
      form.append('repair_bill', file, file.name);
      this.http.put<any>(`${this.api}/update/${id}`, form, headers).subscribe({
        next: () => this.onSubmitOk(id),
        error: (err) => this.onSubmitErr(err),
      });
    } else {
      const payload: Record<string, unknown> = {
        status: 'ReviewPending',
        repair_notes: notes,
      };
      if (rawCost !== '') payload['repair_cost'] = Number(rawCost);
      this.http.put<any>(`${this.api}/update/${id}`, payload, headers).subscribe({
        next: () => this.onSubmitOk(id),
        error: (err) => this.onSubmitErr(err),
      });
    }
  }

  private onSubmitOk(id: number) {
    this.submittingId = null;
    this.reviewNotesById[id] = '';
    this.reviewCostById[id] = '';
    delete this.billFileById[id];
    this.successMsg = 'Submitted to admin for review ✅';
    this.load();
    this.cdr.detectChanges();
    setTimeout(() => {
      this.successMsg = '';
      this.cdr.detectChanges();
    }, 2500);
  }

  private onSubmitErr(err: any) {
    this.submittingId = null;
    this.errorMsg = err.error?.message || 'Failed to submit review';
    this.cdr.detectChanges();
  }
}
