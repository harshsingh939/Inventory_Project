import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { apiUrl } from '../api-url';

export interface RepairCostLogRow {
  id: number;
  asset_id: number;
  issue: string;
  repair_cost: number | null;
  repair_notes: string | null;
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
export class RepairCostLog implements OnInit {
  private readonly apiBase = apiUrl('');

  rows: RepairCostLogRow[] = [];
  isLoading = false;
  errorMsg = '';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.errorMsg = '';
    this.isLoading = true;
    this.http.get<RepairCostLogRow[]>(`${this.apiBase}/repairs/cost-log`).subscribe({
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
}
