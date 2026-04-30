import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { HUB_CATEGORY_ORDER, definitionForSlug } from './asset-category.config';
import { apiUrl } from '../api-url';

export interface InventoryRow {
  id: number;
  name: string;
  details: string | null;
  created_at: string;
  updated_at?: string | null;
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

  inventories: InventoryRow[] = [];
  /** Empty string = all inventories */
  focusInvId: number | '' = '';

  showInvModal = false;
  editingInv: InventoryRow | null = null;
  invForm = { name: '', location: '', owner: '', description: '' };
  invErr = '';
  invSaving = false;

  readonly invCardIcons = ['📦', '🏢', '📋', '🗃️', '🏷️', '📍'] as const;

  invIcon(id: number): string {
    const idx = Math.abs(id) % this.invCardIcons.length;
    return this.invCardIcons[idx];
  }

  invParsed(row: InventoryRow) {
    return parseInventoryDetails(row.details);
  }

  invCardBlurb(row: InventoryRow): string {
    const p = parseInventoryDetails(row.details);
    if (p.description) return p.description;
    if (p.location || p.owner) {
      const bits = [p.location && `Location: ${p.location}`, p.owner && `Owner: ${p.owner}`].filter(Boolean);
      return bits.join(' · ');
    }
    return '—';
  }

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

  queryForCategory(): { inv?: number } {
    return this.focusInvId !== '' ? { inv: this.focusInvId as number } : {};
  }

  loadInventories(after?: () => void) {
    this.http.get<InventoryRow[]>(this.apiUrl).subscribe({
      next: (rows) => {
        this.inventories = rows || [];
        after?.();
        this.cdr.detectChanges();
      },
      error: () => {
        this.inventories = [];
        after?.();
        this.cdr.detectChanges();
      },
    });
  }

  openAddInventory() {
    this.editingInv = null;
    this.invForm = { name: '', location: '', owner: '', description: '' };
    this.invErr = '';
    this.showInvModal = true;
  }

  openEditInventory(row: InventoryRow) {
    this.editingInv = row;
    const p = parseInventoryDetails(row.details);
    this.invForm = {
      name: row.name,
      location: p.location,
      owner: p.owner,
      description: p.description,
    };
    this.invErr = '';
    this.showInvModal = true;
  }

  closeInvModal() {
    this.showInvModal = false;
    this.editingInv = null;
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
    const body = { name, details };

    if (this.editingInv) {
      const editedId = this.editingInv.id;
      this.http.put(`${this.apiUrl}/${editedId}`, body).subscribe({
        next: () => {
          this.invSaving = false;
          this.closeInvModal();
          this.loadInventories(() => {
            this.focusInvId = editedId;
          });
        },
        error: (e) => {
          this.invSaving = false;
          this.invErr = e.error?.message || 'Update failed';
          this.cdr.detectChanges();
        },
      });
    } else {
      this.http.post<{ id?: number }>(this.apiUrl, body).subscribe({
        next: (res) => {
          const newId = res?.id;
          this.invSaving = false;
          this.closeInvModal();
          this.loadInventories(() => {
            if (newId != null && Number.isFinite(newId)) {
              this.focusInvId = newId;
            } else if (this.inventories.length === 1) {
              this.focusInvId = this.inventories[0].id;
            }
          });
        },
        error: (e) => {
          this.invSaving = false;
          this.invErr = e.error?.message || 'Create failed';
          this.cdr.detectChanges();
        },
      });
    }
  }

  deleteInventory(row: InventoryRow) {
    const ok = confirm(
      `Remove inventory "${row.name}"? Assets in this list will no longer be linked to it (they stay in the database).`,
    );
    if (!ok) return;
    this.http.delete(`${this.apiUrl}/${row.id}`).subscribe({
      next: () => this.loadInventories(),
      error: (e) => alert(e.error?.message || 'Delete failed'),
    });
  }
}
