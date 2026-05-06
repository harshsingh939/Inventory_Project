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
  created_at: string;
  updated_at?: string | null;
  /** Filled by GET /api/inventories (live from `assets.inventory_id`). */
  asset_count?: number;
  asset_names?: string;
  assets?: InventoryAssetRef[];
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
  invForm = { name: '', location: '', owner: '', description: '' };
  invErr = '';
  invSaving = false;

  readonly invCardIcons = ['📦', '🏢', '📋', '🗃️', '🏷️', '📍'] as const;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadInventories();
  }

  meta(slug: string) {
    return definitionForSlug(slug);
  }

  /** User-created lists (not fixed hub category rows). */
  get customInventories(): InventoryRow[] {
    return this.inventories
      .filter((inv) => !isHubCategoryInventory(inv))
      .sort((a, b) => Number(b.id) - Number(a.id));
  }

  invIcon(id: number): string {
    const idx = Math.abs(id) % this.invCardIcons.length;
    return this.invCardIcons[idx];
  }

  /** For template: only show chip row when location or owner exists. */
  invDetailChips(inv: InventoryRow): { location: string; owner: string; description: string } | null {
    const p = parseInventoryDetails(inv.details);
    return p.location || p.owner ? p : null;
  }

  customCardBlurb(inv: InventoryRow): string {
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
    this.invForm = { name: '', location: '', owner: '', description: '' };
    this.invErr = '';
    this.showInvModal = true;
  }

  closeInvModal() {
    this.showInvModal = false;
    this.invErr = '';
    this.invSaving = false;
  }

  saveInventory() {
    const name = this.invForm.name.trim();
    if (!name) {
      this.invErr = 'Name is required';
      return;
    }
    this.invErr = '';
    this.invSaving = true;
    const details = composeInventoryDetails(
      this.invForm.location,
      this.invForm.owner,
      this.invForm.description,
    );
    this.http.post<{ id?: number; message?: string }>(this.apiUrl, { name, details }).subscribe({
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
    const ok = confirm(
      `Remove inventory "${inv.name}"? Assets stay in the database but are unlinked from this list.`,
    );
    if (!ok) return;
    this.http.delete(`${this.apiUrl}/${inv.id}`).subscribe({
      next: () => this.loadInventories(),
      error: (e) => alert(e.error?.message || 'Delete failed'),
    });
  }
}
