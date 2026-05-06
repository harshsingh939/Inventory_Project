import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { debounceTime, filter, merge, Subscription } from 'rxjs';
import { apiOrigin, apiUrl } from '../api-url';
import { RepairCostLogRefresh } from '../repair-cost-log-refresh.service';

export interface RepairCostLogRow {
  id: number;
  asset_id: number;
  issue: string;
  repair_cost: number | null;
  repair_notes: string | null;
  /** Relative path under /api/uploads/ (e.g. repair-bills/… ) */
  repair_bill?: string | null;
  /** When the repair was opened (your DB uses reported_at) */
  reported_at?: string;
  created_at?: string;
  fixed_at?: string | null;
  asset_type?: string | null;
  brand?: string | null;
  model?: string | null;
}

@Component({
  selector: 'app-repair-cost-log',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './repair-cost-log.html',
  styleUrl: './repair-cost-log.css'
})
export class RepairCostLog implements OnInit, OnDestroy {
  private readonly apiBase = apiUrl('');

  rows: RepairCostLogRow[] = [];
  isLoading = false;
  errorMsg = '';
  private navSub?: Subscription;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private repairCostLogRefresh: RepairCostLogRefresh,
  ) {}

  ngOnInit() {
    this.load();
    this.navSub = merge(
      this.repairCostLogRefresh.events$,
      this.router.events.pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        filter((e) => {
          const u = e.urlAfterRedirects.split('?')[0];
          return u === '/repair-costs' || u.endsWith('/repair-costs');
        }),
      ),
    )
      .pipe(debounceTime(80))
      .subscribe(() => this.load());
  }

  ngOnDestroy() {
    this.navSub?.unsubscribe();
  }

  load() {
    this.errorMsg = '';
    this.isLoading = true;
    this.http
      .get<RepairCostLogRow[]>(`${this.apiBase}/repairs/cost-log`, {
        params: { _: String(Date.now()) },
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      })
      .subscribe({
      next: (data) => {
        this.rows = data ?? [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMsg = 'Could not load repair cost history.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  deviceLabel(r: RepairCostLogRow): string {
    if (r.asset_type || r.brand || r.model) {
      return `${r.asset_type ?? ''} — ${r.brand ?? ''} ${r.model ?? ''}`.replace(/\s+/g, ' ').trim();
    }
    return `Asset #${r.asset_id}`;
  }

  /** Prefer completion time when the DB has fixed_at */
  completedTimestamp(r: RepairCostLogRow): string | null {
    const s = r.fixed_at || r.reported_at || r.created_at;
    return s ? String(s) : null;
  }

  billFileUrl(r: RepairCostLogRow): string {
    const rel = (r.repair_bill ?? '').replace(/^\/+/, '').trim();
    if (!rel) return '#';
    return `${apiOrigin()}/api/uploads/${rel}`;
  }

  /** Bill path present (API may send string with spaces). */
  hasBill(r: RepairCostLogRow): boolean {
    return Boolean((r.repair_bill ?? '').toString().trim());
  }

  /** Suggested filename for the download attribute (last segment of stored path). */
  billDownloadName(r: RepairCostLogRow): string {
    const rel = (r.repair_bill ?? '').toString().trim().replace(/^\/+/, '');
    if (!rel) return `repair-bill-${r.id}`;
    const base = rel.split(/[/\\]/).pop() || `repair-bill-${r.id}`;
    return base.replace(/[^a-zA-Z0-9._-]/g, '_') || `repair-bill-${r.id}`;
  }

  /** DECIMAL from MySQL is often a string; treat 0 as a valid cost. */
  repairCostAmount(r: RepairCostLogRow): number | null {
    const v = r.repair_cost as unknown;
    if (v == null || v === '') return null;
    if (typeof v === 'number') {
      return Number.isFinite(v) ? v : null;
    }
    const n = parseFloat(String(v).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : null;
  }

  hasRepairCost(r: RepairCostLogRow): boolean {
    return this.repairCostAmount(r) !== null;
  }
}
