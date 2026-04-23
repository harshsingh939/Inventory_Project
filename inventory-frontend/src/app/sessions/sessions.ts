import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  sessionAssignableTypeSet,
  sessionAssetTypeKey,
} from '../assets/asset-category.config';
import { apiUrl } from '../api-url';

@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sessions.html',
  styleUrl: './sessions.css'
})
export class Sessions implements OnInit {
  private readonly apiBase = apiUrl('');

  // dropdown data
  users:  any[] = [];
  availableAssets: any[] = [];

  // active assignments
  activeAssignments: any[] = [];
  allAssignments:    any[] = [];

  // form
  selectedUserId  = '';
  selectedAssetId = '';
  conditionBefore = 'Good';

  isLoading  = false;
  isAssigning = false;
  errorMsg   = '';
  successMsg = '';
  /** API failed for /assets/available */
  assetLoadError = '';
  /** API returned rows but none matched session type allow-list (custom types) */
  assetLoadHint = '';
  activeTab  = 'active'; // 'active' | 'history'

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.isLoading = true;
    this.assetLoadError = '';
    this.assetLoadHint = '';

    // load users
    this.http.get<any[]>(`${this.apiBase}/users`).subscribe({
      next: (data) => { this.users = data; this.cdr.detectChanges(); }
    });

    // load available assets
    this.http.get<any[]>(`${this.apiBase}/assets/available`).subscribe({
      next: (data) => {
        const raw = Array.isArray(data) ? data : [];
        const allow = sessionAssignableTypeSet();
        const filtered = raw.filter((a) =>
          allow.has(sessionAssetTypeKey(a.asset_type)),
        );
        if (filtered.length === 0 && raw.length > 0) {
          this.availableAssets = raw;
          this.assetLoadHint =
            'Some assets use a custom type name; showing all free assets from the server. Prefer types from the Assets categories for consistency.';
        } else {
          this.availableAssets = filtered;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.assetLoadError =
          err.error?.message ||
          (typeof err.error === 'string' ? err.error : null) ||
          'Could not load available assets. Check that the API is running and /api/assets/available works.';
        this.availableAssets = [];
        this.cdr.detectChanges();
      },
    });

    // load active assignments
    this.http.get<any[]>(`${this.apiBase}/sessions/active`).subscribe({
      next: (data) => {
         console.log('Active assignments:', data);
        this.activeAssignments = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isLoading = false; }
    });

    // load history
    this.http.get<any[]>(`${this.apiBase}/sessions/all`).subscribe({
      next: (data) => { this.allAssignments = data; this.cdr.detectChanges(); }
    });
  }

  assignAsset() {
    if (!this.selectedUserId) {
      this.errorMsg = 'Please select a user'; return;
    }
    if (!this.selectedAssetId) {
      this.errorMsg = 'Please select an asset'; return;
    }

    this.errorMsg = '';
    this.successMsg = '';
    this.isAssigning = true;

    this.http.post<any>(`${this.apiBase}/sessions/start`, {
      user_id:          this.selectedUserId,
      asset_id:         this.selectedAssetId,
      condition_before: this.conditionBefore
    }).subscribe({
      next: (res) => {
        this.isAssigning = false;
        this.successMsg = '✅ Asset assigned successfully!';
        this.selectedUserId  = '';
        this.selectedAssetId = '';
        this.conditionBefore = 'Good';
        this.loadAll(); // refresh all data
        this.cdr.detectChanges();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => {
        this.isAssigning = false;
        this.errorMsg = err.error?.message || 'Failed to assign asset';
        this.cdr.detectChanges();
      }
    });
  }

  unassignAsset(assignmentId: number) {
    this.http.post<any>(`${this.apiBase}/sessions/end`, {
      assignment_id: assignmentId,
      condition_after: 'Good'
    }).subscribe({
      next: () => {
        this.successMsg = '✅ Asset unassigned!';
        this.loadAll();
        this.cdr.detectChanges();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => {
        this.errorMsg = err.error?.message || 'Failed to unassign';
        this.cdr.detectChanges();
      }
    });
  }

  getUserName(id: string): string {
    const user = this.users.find(u => u.id == id);
    return user ? user.name : '';
  }

  getAssetName(id: string): string {
    const asset = this.availableAssets.find(a => a.id == id);
    return asset ? `${asset.asset_type} - ${asset.brand}` : '';
  }
}