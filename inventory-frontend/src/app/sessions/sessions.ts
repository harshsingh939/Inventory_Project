import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sessions.html',
  styleUrl: './sessions.css'
})
export class Sessions implements OnInit {
  private apiUrl = 'http://localhost:3000/api';

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
  activeTab  = 'active'; // 'active' | 'history'

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.isLoading = true;

    // load users
    this.http.get<any[]>(`${this.apiUrl}/users`).subscribe({
      next: (data) => { this.users = data; this.cdr.detectChanges(); }
    });

    // load available assets
    this.http.get<any[]>(`${this.apiUrl}/assets/available`).subscribe({
      next: (data) => { this.availableAssets = data; this.cdr.detectChanges(); }
    });

    // load active assignments
    this.http.get<any[]>(`${this.apiUrl}/sessions/active`).subscribe({
      next: (data) => {
         console.log('Active assignments:', data);
        this.activeAssignments = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isLoading = false; }
    });

    // load history
    this.http.get<any[]>(`${this.apiUrl}/sessions/all`).subscribe({
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

    this.http.post<any>(`${this.apiUrl}/sessions/start`, {
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
    this.http.post<any>(`${this.apiUrl}/sessions/end`, {
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