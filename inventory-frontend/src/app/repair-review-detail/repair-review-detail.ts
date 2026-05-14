import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { apiOrigin, apiUrl } from '../api-url';
import { AuthService } from '../auth.service';
import { RepairCostLogRefresh } from '../repair-cost-log-refresh.service';
import { ToastService } from '../toast.service';

@Component({
  selector: 'app-repair-review-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './repair-review-detail.html',
  styleUrl: './repair-review-detail.css',
})
export class RepairReviewDetail implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly repairCostLogRefresh = inject(RepairCostLogRefresh);
  private readonly toast = inject(ToastService);

  row: Record<string, unknown> | null = null;
  loading = false;
  errorMsg = '';
  successMsg = '';
  savingFixed = false;
  adminFinalNotes = '';

  ngOnInit() {
    if (!this.auth.isLoggedIn() || !this.auth.isAdmin()) {
      void this.router.navigate(['/not-authorized']);
      return;
    }
    this.route.paramMap.subscribe((pm) => {
      const id = Number(pm.get('id'));
      if (!Number.isFinite(id) || id <= 0) {
        this.errorMsg = 'Invalid repair id';
        return;
      }
      this.load(id);
    });
  }

  load(id: number) {
    this.loading = true;
    this.errorMsg = '';
    this.row = null;
    this.http.get<Record<string, unknown>>(`${apiUrl('repairs')}/admin/detail/${id}`).subscribe({
      next: (data) => {
        this.row = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.message || 'Could not load repair';
        this.cdr.detectChanges();
      },
    });
  }

  repairId(): number {
    const id = this.row?.['id'];
    const n = Number(id);
    return Number.isFinite(n) ? n : 0;
  }

  billUrl(): string {
    const rel = String(this.row?.['repair_bill'] ?? '')
      .replace(/^\/+/, '')
      .trim();
    if (!rel) return '#';
    return `${apiOrigin()}/api/uploads/${rel}`;
  }

  hasBill(): boolean {
    return Boolean(String(this.row?.['repair_bill'] ?? '').trim());
  }

  markFixed() {
    const id = this.repairId();
    if (!id) return;
    this.savingFixed = true;
    this.errorMsg = '';
    this.successMsg = '';
    const notes = String(this.adminFinalNotes ?? '').trim();
    const vendorNotes = this.row?.['repair_notes'];
    const body: Record<string, unknown> = {
      status: 'Fixed',
      repair_cost: this.row?.['repair_cost'] ?? null,
      repair_notes: notes || vendorNotes || null,
    };
    this.http.put(`${apiUrl('repairs')}/update/${id}`, body).subscribe({
      next: () => {
        this.savingFixed = false;
        this.repairCostLogRefresh.notify();
        this.successMsg = '';
        this.toast.success('Repair marked as Fixed. Asset is Available again.');
        this.load(id);
        this.cdr.detectChanges();
        setTimeout(() => {
          void this.router.navigate(['/repairs']);
        }, 1000);
      },
      error: (err) => {
        this.savingFixed = false;
        const msg = err.error?.message || 'Failed to update';
        this.errorMsg = msg;
        this.toast.error(msg);
        this.cdr.detectChanges();
      },
    });
  }
}
