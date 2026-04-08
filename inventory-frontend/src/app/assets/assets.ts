import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { QRCodeComponent } from 'angularx-qrcode';

@Component({
  selector: 'app-assets',
  standalone: true,
  imports: [CommonModule, FormsModule, QRCodeComponent],  // ✅ QRCodeComponent add
  templateUrl: './assets.html',
  styleUrls: ['./assets.css']
})
export class Assets implements OnInit {
  private apiUrl = 'http://localhost:3000/api/assets';

  asset = {
    asset_type: '',
    brand: '',
    model: '',
    serial_number: '',
    cpu: '',
    ram: '',
    storage: ''
  };

  assets: any[] = [];
  filteredAssets: any[] = [];
  searchType = '';
  searchBrand = '';
  searchStatus = '';
  isLoading = false;
  isAdding = false;
  errorMsg = '';
  successMsg = '';

  // ✅ QR Code variables
  selectedAsset: any = null;
  showQRModal = false;
  qrData = '';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.getAssets();
  }

  getAssets() {
    this.isLoading = true;
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.assets = data;
        this.filteredAssets = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMsg = 'Failed to load assets';
        this.isLoading = false;
      }
    });
  }

  applyFilter() {
    const type   = this.searchType.toLowerCase().trim();
    const brand  = this.searchBrand.toLowerCase().trim();
    const status = this.searchStatus.toLowerCase().trim();

    this.filteredAssets = this.assets.filter(a => {
      const matchType   = type   ? a.asset_type?.toLowerCase().includes(type)   : true;
      const matchBrand  = brand  ? a.brand?.toLowerCase().includes(brand)        : true;
      const matchStatus = status ? a.status?.toLowerCase().includes(status)      : true;
      return matchType && matchBrand && matchStatus;
    });
    this.cdr.detectChanges();
  }

  clearFilter() {
    this.searchType = '';
    this.searchBrand = '';
    this.searchStatus = '';
    this.filteredAssets = [...this.assets];
    this.cdr.detectChanges();
  }

  addAsset() {
    if (!this.asset.asset_type.trim()) {
      this.errorMsg = 'Asset Type is required'; return;
    }
    if (!this.asset.brand.trim()) {
      this.errorMsg = 'Brand is required'; return;
    }
    if (!this.asset.model.trim()) {
      this.errorMsg = 'Model is required'; return;
    }

    this.errorMsg = '';
    this.successMsg = '';
    this.isAdding = true;

    this.http.post<any>(this.apiUrl + '/add', this.asset).subscribe({
      next: (res) => {
        const newAsset = { ...this.asset, id: res.id, status: 'Available' };
        this.assets.push(newAsset);
        this.applyFilter();
        this.isAdding = false;
        this.successMsg = '✅ Asset added successfully!';
        this.asset = { asset_type: '', brand: '', model: '', serial_number: '', cpu: '', ram: '', storage: '' };
        this.cdr.detectChanges();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => {
        this.isAdding = false;
        this.errorMsg = err.error?.message || 'Failed to add asset';
        this.cdr.detectChanges();
      }
    });
  }

  // ✅ QR show karo
  showQR(asset: any) {
  this.selectedAsset = asset;
   const baseUrl = 'http://192.168.68.72:4200';
  
  // ✅ URL format - scan karne pe browser me open hoga
  this.qrData = `http://localhost:4200/asset-details?id=${asset.id}&type=${asset.asset_type}&brand=${asset.brand}&model=${asset.model}&serial=${asset.serial_number || 'N/A'}&cpu=${asset.cpu || 'N/A'}&ram=${asset.ram || 'N/A'}&storage=${asset.storage || 'N/A'}&status=${asset.status}`;
  
  this.showQRModal = true;
  this.cdr.detectChanges();
}

  // ✅ QR close karo
  closeQR() {
    this.showQRModal = false;
    this.selectedAsset = null;
    this.qrData = '';
    this.cdr.detectChanges();
  }

  // ✅ QR download karo
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