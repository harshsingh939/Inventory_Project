import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { apiUrl } from '../api-url';

export interface DisposedItemRow {
  id: number;
  former_asset_id: number;
  inventory_id: number | null;
  inventory_name: string | null;
  asset_type: string;
  brand: string;
  model: string;
  serial_number: string | null;
  assignment_id: number | null;
  user_name: string | null;
  employee_id: string | null;
  department: string | null;
  condition_after: string | null;
  notes: string | null;
  disposed_at: string;
}

@Component({
  selector: 'app-disposed-items',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './disposed-items.html',
  styleUrl: './disposed-items.css',
})
export class DisposedItems implements OnInit {
  private readonly api = apiUrl('disposals');

  rows: DisposedItemRow[] = [];
  isLoading = false;
  errorMsg = '';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.isLoading = true;
    this.errorMsg = '';
    this.http.get<DisposedItemRow[]>(this.api).subscribe({
      next: (data) => {
        this.rows = Array.isArray(data) ? data : [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg = err.error?.message || 'Could not load disposed items';
        this.rows = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  deviceLabel(r: DisposedItemRow): string {
    return `${r.asset_type} — ${r.brand} ${r.model}`.trim();
  }

  /** Small icon by asset type for the disposal log table */
  deviceIcon(r: DisposedItemRow): string {
    const t = (r.asset_type || '').toLowerCase();
    if (t.includes('laptop')) return '💻';
    if (t.includes('desktop') || t.includes('workstation') || t.includes('pc')) return '🖥️';
    if (t.includes('monitor') || t.includes('display')) return '🖵';
    if (t.includes('phone') || t.includes('mobile')) return '📱';
    if (t.includes('printer')) return '🖨️';
    if (t.includes('cable') || t.includes('network') || t.includes('router')) return '🔌';
    return '📦';
  }
}
