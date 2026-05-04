import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../notification.service';
import { apiUrl } from '../api-url';

@Component({
  selector: 'app-repairs',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './repairs.html',
  styleUrl: './repairs.css'
})
export class Repairs implements OnInit {
  private readonly apiBase = apiUrl('');

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

  /** Modal when marking a repair Fixed: ask → optional cost/notes */
  fixDialogRepair: any = null;
  fixDialogStep: 'ask' | 'details' = 'ask';
  fixRepairCost = '';
  fixRepairNotes = '';
  isSavingFix = false;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private notifications: NotificationService
  ) {}

  ngOnInit() {
    this.getRepairs();
    this.getAssets();
  }

  getAssets() {
    this.http.get<any[]>(`${this.apiBase}/assets`).subscribe({
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
    this.http.get<any[]>(`${this.apiBase}/repairs`).subscribe({
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

    this.http.post<any>(`${this.apiBase}/repairs/add`, this.repair).subscribe({
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
        this.notifications.fetchNotifications();
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
    this.http.put<any>(`${this.apiBase}/repairs/update/${repairId}`, { status }).subscribe({
      next: () => {
        const repair = this.repairs.find(r => r.id === repairId);
        if (repair) repair.status = status;
        this.applyFilter();
        this.notifications.fetchNotifications();
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

  openMarkFixedDialog(repair: any) {
    this.errorMsg = '';
    this.fixDialogRepair = { ...repair };
    this.fixDialogStep = 'ask';
    this.fixRepairCost = '';
    this.fixRepairNotes = '';
    this.cdr.detectChanges();
  }

  goToFixDetailsStep() {
    this.errorMsg = '';
    this.fixDialogStep = 'details';
    this.cdr.detectChanges();
  }

  goToFixAskStep() {
    if (this.isSavingFix) return;
    this.errorMsg = '';
    this.fixDialogStep = 'ask';
    this.cdr.detectChanges();
  }

  closeFixDialog() {
    if (this.isSavingFix) return;
    this.fixDialogRepair = null;
    this.fixDialogStep = 'ask';
    this.cdr.detectChanges();
  }

  markFixedSkipExtras() {
    this.putFixedStatus(null, null);
  }

  submitFixWithDetails() {
    // type="number" binds a number — never call .trim() on it
    const raw = String(this.fixRepairCost ?? '').trim();
    if (raw !== '') {
      const n = parseFloat(raw);
      if (Number.isNaN(n) || n < 0) {
        this.errorMsg = 'Enter a valid repair cost, or leave the field empty.';
        this.cdr.detectChanges();
        return;
      }
    }
    const costVal = raw === '' ? null : parseFloat(raw);
    const notesVal = String(this.fixRepairNotes ?? '').trim() || null;
    this.putFixedStatus(costVal, notesVal);
  }

  private putFixedStatus(repairCost: number | null, repairNotes: string | null) {
    if (!this.fixDialogRepair) return;
    const repairId = Number(this.fixDialogRepair.id);
    this.errorMsg = '';
    this.isSavingFix = true;
    this.cdr.detectChanges();

    this.http
      .put<any>(`${this.apiBase}/repairs/update/${repairId}`, {
        status: 'Fixed',
        repair_cost: repairCost,
        repair_notes: repairNotes
      })
      .subscribe({
        next: (res: any) => {
          const repair = this.repairs.find((r) => r.id == repairId);
          if (repair) {
            repair.status = 'Fixed';
            repair.repair_cost = res?.repair_cost ?? repairCost;
            repair.repair_notes = res?.repair_notes ?? repairNotes;
            if (res?.fixed_at != null) repair.fixed_at = res.fixed_at;
          }
          this.applyFilter();
          this.isSavingFix = false;
          this.fixDialogRepair = null;
          this.fixDialogStep = 'ask';
          this.successMsg = '✅ Repair marked as Fixed';
          this.notifications.fetchNotifications();
          this.cdr.detectChanges();
          setTimeout(() => {
            this.successMsg = '';
            this.cdr.detectChanges();
          }, 3000);
        },
        error: (err) => {
          this.isSavingFix = false;
          this.errorMsg = err.error?.message || 'Failed to update status';
          this.cdr.detectChanges();
        }
      });
  }
}