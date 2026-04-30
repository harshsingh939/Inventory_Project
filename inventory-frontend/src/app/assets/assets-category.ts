import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  ActivatedRoute,
  Router,
  RouterLink,
} from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import { QRCodeComponent } from 'angularx-qrcode';
import {
  AssetCategoryDefinition,
  assetBelongsToSlug,
  definitionForSlug,
  isSessionAssignableCategorySlug,
} from './asset-category.config';
import type { InventoryRow } from './assets-hub';
import { apiUrl } from '../api-url';

@Component({
  selector: 'app-assets-category',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, QRCodeComponent],
  templateUrl: './assets-category.html',
  styleUrls: ['./assets.css', './assets-category.css'],
})
export class AssetsCategory implements OnInit, OnDestroy {
  private readonly apiAssets = apiUrl('assets');
  private readonly apiInv = apiUrl('inventories');
  private routeSub?: Subscription;
  private lastCategorySlug = '';

  slug = '';
  cat: AssetCategoryDefinition | null = null;
  isPc = false;
  /** Hub category can appear in Sessions assign dropdown */
  showSessionsHint = false;

  inventories: InventoryRow[] = [];
  /** '' = all */
  filterInvId: number | '' = '';
  /** '' = not set — required when inventories exist */
  assignInvId: number | '' = '';

  asset = {
    asset_type: '',
    brand: '',
    model: '',
    serial_number: '',
    cpu: '',
    ram: '',
    storage: '',
  };

  allAssets: any[] = [];
  filteredAssets: any[] = [];
  searchBrand = '';
  searchStatus = '';
  isLoading = false;
  isAdding = false;
  errorMsg = '';
  successMsg = '';

  selectedAsset: any = null;
  showQRModal = false;
  qrData = '';

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.routeSub = combineLatest([
      this.route.paramMap,
      this.route.queryParamMap,
    ]).subscribe(([pm, qm]) => {
      const s = pm.get('category') || '';
      const def = definitionForSlug(s);
      if (!def) {
        this.router.navigate(['/assets']);
        return;
      }
      const slugChanged = s !== this.lastCategorySlug;
      this.lastCategorySlug = s;

      this.slug = s;
      this.cat = def;
      this.isPc = def.ui === 'pc';
      this.showSessionsHint = isSessionAssignableCategorySlug(s);

      const invQ = qm.get('inv');
      this.filterInvId =
        invQ && invQ !== 'all' && !isNaN(Number(invQ)) ? Number(invQ) : '';
      if (this.filterInvId !== '') {
        this.assignInvId = this.filterInvId;
      }

      if (slugChanged) {
        this.resetFormForCategory();
        this.loadInventoriesAndAssets();
      } else {
        this.refreshInventoriesThenAssets();
      }
    });
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
  }

  invLabel(id: number | null | undefined): string {
    if (id == null) return '—';
    const row = this.inventories.find((i) => i.id === id);
    return row ? row.name : `#${id}`;
  }

  /** Table colspan for empty row */
  tableColspan(): number {
    const inv = this.inventories.length > 0 ? 1 : 0;
    return (this.isPc ? 10 : 7) + inv;
  }

  onFilterInvChange() {
    const q =
      this.filterInvId !== '' ? { inv: this.filterInvId as number } : {};
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: q,
      replaceUrl: true,
    });
    if (this.filterInvId !== '') {
      this.assignInvId = this.filterInvId;
    } else {
      this.ensureAssignInventoryDefault();
    }
  }

  /** Keep "Add new assets to" valid whenever inventories exist */
  private ensureAssignInventoryDefault() {
    if (this.inventories.length === 0) return;
    const ids = new Set(this.inventories.map((i) => i.id));
    if (this.filterInvId !== '' && ids.has(Number(this.filterInvId))) {
      this.assignInvId = this.filterInvId;
      return;
    }
    if (this.assignInvId === '' || !ids.has(Number(this.assignInvId))) {
      this.assignInvId = this.inventories[0].id;
    }
  }

  /**
   * After inventories load: fix URL/state so new assets use a real inventory
   * (single inventory → filter + URL; multiple → default "add to" newest list row).
   * @returns true if navigation will re-trigger route; caller should skip getAssets once.
   */
  private syncInventorySelectionsAfterLoad(): boolean {
    const ids = new Set(this.inventories.map((i) => i.id));

    if (this.filterInvId !== '' && !ids.has(Number(this.filterInvId))) {
      this.filterInvId = '';
      this.assignInvId = '';
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true,
      });
      return true;
    }

    if (this.assignInvId !== '' && !ids.has(Number(this.assignInvId))) {
      this.assignInvId = '';
    }

    if (this.inventories.length === 0) {
      return false;
    }

    if (this.filterInvId !== '' && ids.has(Number(this.filterInvId))) {
      this.assignInvId = this.filterInvId;
      return false;
    }

    if (this.inventories.length === 1) {
      const only = this.inventories[0].id;
      this.assignInvId = only;
      this.filterInvId = only;
      const invParam = this.route.snapshot.queryParamMap.get('inv');
      if (invParam !== String(only)) {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { inv: only },
          replaceUrl: true,
        });
        return true;
      }
      return false;
    }

    if (this.assignInvId === '' || !ids.has(Number(this.assignInvId))) {
      this.assignInvId = this.inventories[0].id;
    }
    return false;
  }

  private resetFormForCategory() {
    if (!this.cat) return;
    if (this.isPc) {
      const first = this.cat.types[0] || '';
      this.asset = {
        asset_type: first,
        brand: '',
        model: '',
        serial_number: '',
        cpu: '',
        ram: '',
        storage: '',
      };
    } else {
      const first = this.cat.types[0] || '';
      this.asset = {
        asset_type: first,
        brand: '',
        model: '',
        serial_number: '',
        cpu: '',
        ram: '',
        storage: '',
      };
    }
  }

  private loadInventoriesAndAssets() {
    this.http.get<InventoryRow[]>(this.apiInv).subscribe({
      next: (rows) => {
        this.inventories = rows || [];
        const skipGet = this.syncInventorySelectionsAfterLoad();
        this.cdr.detectChanges();
        if (!skipGet) {
          this.getAssets();
        }
      },
      error: () => {
        this.inventories = [];
        this.filterInvId = '';
        this.assignInvId = '';
        this.cdr.detectChanges();
        this.getAssets();
      },
    });
  }

  /** Same category, query or nav changed — reload inventories so hub changes stay in sync */
  private refreshInventoriesThenAssets() {
    this.http.get<InventoryRow[]>(this.apiInv).subscribe({
      next: (rows) => {
        this.inventories = rows || [];
        const skipGet = this.syncInventorySelectionsAfterLoad();
        this.ensureAssignInventoryDefault();
        this.cdr.detectChanges();
        if (!skipGet) {
          this.getAssets();
        }
      },
      error: () => {
        this.ensureAssignInventoryDefault();
        this.getAssets();
      },
    });
  }

  getAssets() {
    this.isLoading = true;
    const url =
      this.filterInvId !== ''
        ? `${this.apiAssets}?inventory_id=${this.filterInvId}`
        : this.apiAssets;
    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        this.allAssets = data || [];
        this.applyFilter();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMsg = 'Failed to load assets';
        this.isLoading = false;
      },
    });
  }

  private inCategory(a: any): boolean {
    if (!this.slug) return false;
    return assetBelongsToSlug(a.asset_type || '', this.slug);
  }

  applyFilter() {
    const brand = this.searchBrand.toLowerCase().trim();
    const status = this.searchStatus.toLowerCase().trim();
    this.filteredAssets = this.allAssets.filter((a) => {
      if (!this.inCategory(a)) return false;
      const matchBrand = brand ? a.brand?.toLowerCase().includes(brand) : true;
      const matchStatus = status ? a.status?.toLowerCase().includes(status) : true;
      return matchBrand && matchStatus;
    });
    this.cdr.detectChanges();
  }

  clearFilter() {
    this.searchBrand = '';
    this.searchStatus = '';
    this.applyFilter();
  }

  addAsset() {
    if (!this.cat) return;
    if (!this.asset.asset_type.trim()) {
      this.errorMsg = 'Asset type is required';
      return;
    }
    if (!this.asset.brand.trim()) {
      this.errorMsg = 'Brand is required';
      return;
    }
    if (!this.asset.model.trim()) {
      this.errorMsg = 'Model is required';
      return;
    }
    if (this.slug !== 'other') {
      const ok = this.cat.types.some(
        (t) => t.toLowerCase() === this.asset.asset_type.trim().toLowerCase(),
      );
      if (!ok) {
        this.errorMsg = 'Pick a type from the list for this category';
        return;
      }
    }
    if (this.inventories.length > 0 && this.assignInvId === '') {
      this.errorMsg = 'Select which inventory this asset belongs to';
      return;
    }

    this.errorMsg = '';
    this.successMsg = '';
    this.isAdding = true;

    const body: Record<string, unknown> = this.isPc
      ? { ...this.asset }
      : {
          ...this.asset,
          cpu: '',
          ram: '',
          storage: '',
        };

    if (this.assignInvId !== '') {
      body['inventory_id'] = this.assignInvId;
    }

    this.http.post<any>(this.apiAssets + '/add', body).subscribe({
      next: (res) => {
        const newAsset = {
          ...body,
          id: res.id,
          status: 'Available',
          inventory_id: this.assignInvId !== '' ? this.assignInvId : null,
        };
        this.allAssets.push(newAsset);
        this.applyFilter();
        this.isAdding = false;
        this.successMsg = '✅ Asset added successfully!';
        this.resetFormForCategory();
        this.ensureAssignInventoryDefault();
        this.cdr.detectChanges();
        setTimeout(() => {
          this.successMsg = '';
          this.cdr.detectChanges();
        }, 3000);
      },
      error: (err) => {
        this.isAdding = false;
        this.errorMsg = err.error?.message || 'Failed to add asset';
        this.cdr.detectChanges();
      },
    });
  }

  showQR(asset: any) {
    this.selectedAsset = asset;
    this.qrData = `http://localhost:4200/asset-details?id=${asset.id}&type=${encodeURIComponent(asset.asset_type)}&brand=${encodeURIComponent(asset.brand)}&model=${encodeURIComponent(asset.model)}&serial=${encodeURIComponent(asset.serial_number || 'N/A')}&cpu=${encodeURIComponent(asset.cpu || 'N/A')}&ram=${encodeURIComponent(asset.ram || 'N/A')}&storage=${encodeURIComponent(asset.storage || 'N/A')}&status=${encodeURIComponent(asset.status || '')}`;
    this.showQRModal = true;
    this.cdr.detectChanges();
  }

  closeQR() {
    this.showQRModal = false;
    this.selectedAsset = null;
    this.qrData = '';
    this.cdr.detectChanges();
  }

  downloadQR() {
    const canvas = document.querySelector('.qr-code-wrapper canvas') as HTMLCanvasElement;
    if (canvas) {
      const link = document.createElement('a');
      link.download = `QR_${this.selectedAsset?.asset_type}_${this.selectedAsset?.id}.png`;
      link.href = canvas.toDataURL();
      link.click();
    }
  }
}
