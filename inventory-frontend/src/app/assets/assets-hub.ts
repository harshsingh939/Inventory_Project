import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  HUB_CATEGORY_ORDER,
  definitionForSlug,
  inventoryMatchesCategorySlug,
  isHubCategoryInventory,
} from './asset-category.config';
import { apiUrl } from '../api-url';
import { ToastService } from '../toast.service';

export interface InventoryAssetRef {
  id: number;
  name: string;
  asset_type?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  status?: string;
}

export interface InventoryRow {
  id: number;
  name: string;
  details: string | null;
  /** JSON array of admin-defined column labels (migration 018). */
  custom_columns?: string[] | null;
  created_at: string;
  updated_at?: string | null;
  /** Filled by GET /api/inventories (live from `assets.inventory_id`). */
  asset_count?: number;
  asset_names?: string;
  assets?: InventoryAssetRef[];
}

/** Parse `custom_columns` from API (JSON array or string). */
export function parseCustomColumns(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x ?? '').trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const p = JSON.parse(raw) as unknown;
      return Array.isArray(p) ? parseCustomColumns(p) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Structured lines at top of `details`; remainder is free-form description (backwards-compatible). */
export function parseInventoryDetails(raw: string | null | undefined): {
  location: string;
  owner: string;
  description: string;
} {
  const empty = { location: '', owner: '', description: '' };
  if (raw == null || !String(raw).trim()) return empty;
  const lines = String(raw).split(/\r?\n/);
  let location = '';
  let owner = '';
  let i = 0;
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('Location:')) {
      location = t.slice('Location:'.length).trim();
    } else if (t.startsWith('Owner:')) {
      owner = t.slice('Owner:'.length).trim();
    } else if (t === '') {
      continue;
    } else {
      break;
    }
  }
  const description = lines.slice(i).join('\n').replace(/^\n+/, '').trim();
  return { location, owner, description };
}

export function composeInventoryDetails(
  location: string,
  owner: string,
  description: string,
): string | null {
  const loc = location.trim();
  const own = owner.trim();
  const desc = description.trim();
  const meta: string[] = [];
  if (loc) meta.push(`Location: ${loc}`);
  if (own) meta.push(`Owner: ${own}`);
  const header = meta.join('\n');
  if (header && desc) return `${header}\n\n${desc}`;
  if (header) return header;
  if (desc) return desc;
  return null;
}

@Component({
  selector: 'app-assets-hub',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './assets-hub.html',
  styleUrl: './assets-hub.css',
})
export class AssetsHub implements OnInit {
  readonly slugs = [...HUB_CATEGORY_ORDER];
  private readonly apiUrl = apiUrl('inventories');

  /** Rows from GET /api/inventories (category buckets + custom lists). */
  inventories: InventoryRow[] = [];
  hubLoading = false;

  showInvModal = false;
  invForm = { name: '', columnRows: [] as string[] };
  invErr = '';
  invSaving = false;

  readonly invCardIcons = ['📦', '🏢', '📋', '🗃️', '🏷️', '📍'] as const;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
  ) {}

  ngOnInit() {
    this.loadInventories();
  }

  meta(slug: string) {
    return definitionForSlug(slug);
  }

  /** User-created lists (not fixed hub category rows). Newest card appears at the end. */
  get customInventories(): InventoryRow[] {
    return this.inventories
      .filter((inv) => !isHubCategoryInventory(inv))
      .sort((a, b) => Number(a.id) - Number(b.id));
  }

  invIcon(id: number): string {
    const idx = Math.abs(id) % this.invCardIcons.length;
    return this.invCardIcons[idx];
  }

  customCardBlurb(inv: InventoryRow): string {
    const cols = parseCustomColumns(inv.custom_columns);
    if (cols.length) {
      return `Fields: ${cols.join(' · ')}. Open a category tile below — same add / table / assignments flow as other inventories.`;
    }
    const p = parseInventoryDetails(inv.details);
    if (p.description) return p.description;
    if (p.location || p.owner) {
      const bits = [
        p.location && `Location: ${p.location}`,
        p.owner && `Owner: ${p.owner}`,
      ].filter(Boolean);
      return bits.join(' · ');
    }
    return 'Open below to add assets by category — same flow as the cards above.';
  }

  /** Chips row for custom list cards (location/owner from legacy details + new column labels). */
  invChipRow(inv: InventoryRow): {
    custom: string[];
    meta: { location: string; owner: string } | null;
  } | null {
    const custom = parseCustomColumns(inv.custom_columns);
    const p = parseInventoryDetails(inv.details);
    const meta = p.location || p.owner ? { location: p.location, owner: p.owner } : null;
    if (!custom.length && !meta) return null;
    return { custom, meta };
  }

  /** API row for this hub category (migration 012). */
  rowForSlug(slug: string): InventoryRow | undefined {
    return this.inventories.find((inv) => inventoryMatchesCategorySlug(inv, slug));
  }

  queryForSlug(slug: string): { inv?: number } {
    const row = this.rowForSlug(slug);
    return row ? { inv: row.id } : {};
  }

  loadInventories() {
    this.hubLoading = true;
    this.http.get<InventoryRow[]>(this.apiUrl).subscribe({
      next: (rows) => {
        this.inventories = rows || [];
        this.hubLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.inventories = [];
        this.hubLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  openAddInventory() {
    this.invForm = { name: '', columnRows: [] };
    this.invErr = '';
    this.showInvModal = true;
  }

  addInvColumnRow() {
    this.invForm.columnRows.push('');
  }

  removeInvColumnRow(i: number) {
    this.invForm.columnRows.splice(i, 1);
  }

  /** Keep row DOM when string value changes (default *ngFor tracks by identity and drops focus each keystroke). */
  trackColByIndex(index: number, _item: string): number {
    return index;
  }

  closeInvModal() {
    this.showInvModal = false;
    this.invErr = '';
    this.invSaving = false;
  }

  saveInventory() {
    const name = this.invForm.name.trim();
    if (!name) {
      this.invErr = 'Inventory name is required';
      return;
    }
    const custom_columns = this.invForm.columnRows
      .map((s) => String(s ?? '').trim())
      .filter(Boolean);
    this.invErr = '';
    this.invSaving = true;
    this.http
      .post<{ id?: number; message?: string }>(this.apiUrl, {
        name,
        details: null,
        custom_columns: custom_columns.length ? custom_columns : undefined,
      })
      .subscribe({
        next: (res) => {
          this.invSaving = false;
          this.closeInvModal();
          this.loadInventories();
          this.cdr.detectChanges();
        },
        error: (e) => {
          this.invSaving = false;
          this.invErr = e.error?.message || 'Create failed';
          this.cdr.detectChanges();
        },
      });
  }

  deleteCustomInventory(inv: InventoryRow, ev: Event) {
    ev.preventDefault();
    ev.stopPropagation();
    if (isHubCategoryInventory(inv)) {
      return;
    }
    const label = String(inv.name || '').trim() || 'Inventory';
    this.http.delete(`${this.apiUrl}/${inv.id}`).subscribe({
      next: () => {
        this.toast.success(`Removed ${label}`);
        this.loadInventories();
      },
      error: (e) => {
        this.toast.error(e.error?.message || 'Delete failed');
      },
    });
  }
}
