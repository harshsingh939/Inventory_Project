import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { HUB_CATEGORY_ORDER, definitionForSlug } from '../asset-category.config';
import { apiUrl } from '../../api-url';
import type { InventoryRow } from '../assets-hub';
import { parseInventoryDetails } from '../assets-hub';

@Component({
  selector: 'app-inventory-workspace',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './inventory-workspace.html',
  styleUrl: './inventory-workspace.css',
})
export class AssetsInventoryWorkspace implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly apiOne = apiUrl('inventories');

  readonly slugs = [...HUB_CATEGORY_ORDER];
  readonly invCardIcons = ['📦', '🏢', '📋', '🗃️', '🏷️', '📍'] as const;

  invId = 0;
  inventory: InventoryRow | null = null;
  isLoading = true;
  notFound = false;

  ngOnInit() {
    this.route.paramMap.subscribe((pm) => {
      const raw = pm.get('invId');
      const id = raw != null ? Number(raw) : NaN;
      if (!Number.isFinite(id) || id < 1) {
        this.notFound = true;
        this.isLoading = false;
        this.cdr.detectChanges();
        return;
      }
      this.invId = id;
      this.loadInventory(id);
    });
  }

  meta(slug: string) {
    return definitionForSlug(slug);
  }

  queryForCategory(): { inv: number } {
    return { inv: this.invId };
  }

  invParsed(): ReturnType<typeof parseInventoryDetails> {
    return parseInventoryDetails(this.inventory?.details);
  }

  invIcon(): string {
    const idx = Math.abs(this.invId) % this.invCardIcons.length;
    return this.invCardIcons[idx];
  }

  private loadInventory(id: number) {
    this.isLoading = true;
    this.notFound = false;
    this.inventory = null;
    this.cdr.detectChanges();
    this.http.get<InventoryRow>(`${this.apiOne}/${id}`).subscribe({
      next: (row) => {
        this.inventory = row;
        this.isLoading = false;
        this.notFound = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.inventory = null;
        this.isLoading = false;
        this.notFound = true;
        this.cdr.detectChanges();
      },
    });
  }
}
