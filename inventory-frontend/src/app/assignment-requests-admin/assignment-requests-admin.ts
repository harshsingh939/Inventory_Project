import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { apiUrl } from '../api-url';
import { HUB_CATEGORY_ORDER, assetBelongsToSlug } from '../assets/asset-category.config';

@Component({
  selector: 'app-assignment-requests-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './assignment-requests-admin.html',
  styleUrl: './assignment-requests-admin.css',
})
export class AssignmentRequestsAdmin implements OnInit {
  private readonly api = apiUrl('assignment-requests');

  rows: any[] = [];
  rejectNote: Record<number, string> = {};
  loading = false;
  errorMsg = '';
  successMsg = '';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.load();
  }

  /** Category route under /assets — used so Assignments opens with ticket context (fulfilled after checkout). */
  slugForRequest(r: any): string {
    const types = (r?.asset_types || [])
      .map((x: any) => String(x?.asset_type || '').trim())
      .filter(Boolean);
    for (const slug of HUB_CATEGORY_ORDER) {
      if (slug === 'other') continue;
      for (const t of types) {
        if (assetBelongsToSlug(t, slug)) return slug;
      }
    }
    return 'systems';
  }

  /** Opens Assignments with this ticket so POST /sessions/start sends assignment_request_id → status Fulfilled when slots filled. */
  pickAssetsQuery(r: any): Record<string, string> {
    const invs = r.inventories || [];
    return {
      assign: '1',
      requestId: String(r.id),
      ...(r.auth_user_id != null ? { prefillAuth: String(r.auth_user_id) } : {}),
      ...(invs.length === 1 && invs[0]?.inventory_id != null
        ? { inv: String(invs[0].inventory_id) }
        : {}),
    };
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
