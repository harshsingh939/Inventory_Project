import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-repairs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './repairs.html',
  styleUrl: './repairs.css'
})
export class Repairs implements OnInit {
  private apiUrl = 'http://localhost:3000/api';

  repair = {
    asset_id: '',
    issue: ''
  };

  repairs: any[] = [];
  filteredRepairs: any[] = [];
  assets: any[] = [];
  searchIssue = '';
  searchStatus = '';
  isLoading = false;
  isAdding = false;
  errorMsg = '';
  successMsg = '';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.getRepairs();
    this.getAssets();
  }

  getAssets() {
    this.http.get<any[]>(`${this.apiUrl}/assets`).subscribe({
      next: (data) => {
        this.assets = data;
        this.cdr.detectChanges();
      }
    });
  }

  getAssetName(id: any): string {
    const asset = this.assets.find(a => a.id == id);
    return asset ? `${asset.asset_type} — ${asset.brand} ${asset.model}` : `Asset #${id}`;
  }

  getRepairs() {
    this.isLoading = true;
    this.http.get<any[]>(`${this.apiUrl}/repairs`).subscribe({
      next: (data) => {
        this.repairs = data;
        this.filteredRepairs = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMsg = 'Failed to load repairs';
        this.isLoading = false;
      }
    });
  }

  applyFilter() {
    const issue  = this.searchIssue.toLowerCase().trim();
    const status = this.searchStatus.toLowerCase().trim();

    this.filteredRepairs = this.repairs.filter(r => {
      const matchIssue  = issue  ? r.issue?.toLowerCase().includes(issue)   : true;
      const matchStatus = status ? r.status?.toLowerCase().includes(status) : true;
      return matchIssue && matchStatus;
    });
    this.cdr.detectChanges();
  }

  clearFilter() {
    this.searchIssue = '';
    this.searchStatus = '';
    this.filteredRepairs = [...this.repairs];
    this.cdr.detectChanges();
  }

  addRepair() {
    if (!this.repair.asset_id) {
      this.errorMsg = 'Please select an asset'; return;
    }
    if (!this.repair.issue.trim()) {
      this.errorMsg = 'Issue description is required'; return;
    }

    this.errorMsg = '';
    this.successMsg = '';
    this.isAdding = true;

    this.http.post<any>(`${this.apiUrl}/repairs/add`, this.repair).subscribe({
      next: (res) => {
        const newRepair = {
          id: res.id,
          asset_id: this.repair.asset_id,
          issue: this.repair.issue,
          status: 'Pending'
        };
        this.repairs.push(newRepair);
        this.applyFilter();

        this.isAdding = false;
        this.successMsg = '✅ Repair request added!';
        this.repair = { asset_id: '', issue: '' };
        this.cdr.detectChanges();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => {
        this.isAdding = false;
        this.errorMsg = err.error?.message || 'Failed to add repair';
        this.cdr.detectChanges();
      }
    });
  }

  updateStatus(repairId: number, status: string) {
    this.http.put<any>(`${this.apiUrl}/repairs/update/${repairId}`, { status }).subscribe({
      next: () => {
        const repair = this.repairs.find(r => r.id === repairId);
        if (repair) repair.status = status;
        this.applyFilter();
        this.successMsg = `✅ Status updated to ${status}`;
        this.cdr.detectChanges();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => {
        this.errorMsg = err.error?.message || 'Failed to update status';
        this.cdr.detectChanges();
      }
    });
  }
}