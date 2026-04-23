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
  invForm = { name: '', details: '' };
  invErr = '';
  invSaving = false;

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

  loadInventories() {
    this.http.get<InventoryRow[]>(this.apiUrl).subscribe({
      next: (rows) => {
        this.inventories = rows || [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.inventories = [];
        this.cdr.detectChanges();
      },
    });
  }

  openAddInventory() {
    this.editingInv = null;
    this.invForm = { name: '', details: '' };
    this.invErr = '';
    this.showInvModal = true;
  }

  openEditInventory(row: InventoryRow) {
    this.editingInv = row;
    this.invForm = { name: row.name, details: row.details || '' };
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
    const body = { name, details: this.invForm.details.trim() || null };

    if (this.editingInv) {
      this.http.put(`${this.apiUrl}/${this.editingInv.id}`, body).subscribe({
        next: () => {
          this.invSaving = false;
          this.closeInvModal();
          this.loadInventories();
        },
        error: (e) => {
          this.invSaving = false;
          this.invErr = e.error?.message || 'Update failed';
          this.cdr.detectChanges();
        },
      });
    } else {
      this.http.post<{ id: number }>(this.apiUrl, body).subscribe({
        next: () => {
          this.invSaving = false;
          this.closeInvModal();
          this.loadInventories();
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
