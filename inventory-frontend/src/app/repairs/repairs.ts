import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../notification.service';
import { RepairCostLogRefresh } from '../repair-cost-log-refresh.service';
import { AuthService } from '../auth.service';
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
  fixBillFile: File | null = null;
  fixBillFileName = '';
  @ViewChild('fixBillInput') private fixBillInput?: ElementRef<HTMLInputElement>;
  isSavingFix = false;

  /** Admin assigns pending repair to repair_authority account */
  authorityList: { id: number; username: string; email: string }[] = [];
  /** Selected auth_users.id per repair row (number | null — avoid string '' → Number → 0 bug) */
  authorityChoice: Record<number, number | null> = {};
  authorityListLoaded = false;
  assigningId: number | null = null;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private notifications: NotificationService,
    private repairCostLogRefresh: RepairCostLogRefresh,
    private auth: AuthService,
  ) {}

  get isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  /** Legacy DB value `WithAuthority` — display and logic use `Under repair`. */
  static readonly REPAIR_HANDOFF = 'Under repair';

  private normalizeRepairList(list: any[]): void {
    for (const r of list || []) {
      if (r && r.status === 'WithAuthority') {
        r.status = Repairs.REPAIR_HANDOFF;
      }
    }
  }

  ngOnInit() {
    this.getRepairs();
    this.loadRepairAssetChoices();
    if (this.auth.isAdmin()) {
      this.http.get<any[]>(`${this.apiBase}/auth/repair-authorities`).subscribe({
        next: (rows) => {
          this.authorityList = Array.isArray(rows) ? rows : [];
          this.authorityListLoaded = true;
          this.cdr.detectChanges();
        },
        error: () => {
          this.authorityListLoaded = true;
          this.authorityList = [];
        },
      });
    }
  }

  assignAuthority(r: any) {
    const raw = this.authorityChoice[r.id];
    const aid = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim());
    if (!Number.isFinite(aid) || aid <= 0) {
      this.errorMsg = this.authorityList.length
        ? 'Choose a repair authority from the dropdown before assigning.'
        : 'No repair-authority logins exist yet. Create an account with role repair_authority, then refresh this page.';
      this.cdr.detectChanges();
      return;
    }
    this.errorMsg = '';
    this.assigningId = r.id;
    this.http
      .post<any>(`${this.apiBase}/repairs/assign-to-authority`, {
        repair_id: r.id,
        authority_auth_user_id: aid,
      })
      .subscribe({
        next: () => {
          this.assigningId = null;
          const row = this.repairs.find((x) => x.id === r.id);
          if (row) {
            row.status = Repairs.REPAIR_HANDOFF;
            row.assigned_authority_auth_user_id = aid;
          }
          this.applyFilter();
          this.successMsg = 'Assigned to repair authority ✅';
          this.cdr.detectChanges();
          setTimeout(() => {
            this.successMsg = '';
            this.cdr.detectChanges();
          }, 3000);
        },
        error: (err) => {
          this.assigningId = null;
          this.errorMsg = err.error?.message || 'Assign failed';
          this.cdr.detectChanges();
        },
      });
  }

  /** Admin: all assets. User: only equipment on an active assignment to them (same source as My workspace). */
  loadRepairAssetChoices() {
    if (this.auth.isAdmin()) {
      this.http.get<any[]>(`${this.apiBase}/assets`).subscribe({
        next: (data) => {
          this.assets = Array.isArray(data) ? data : [];
          this.cdr.detectChanges();
        },
      });
      return;
    }
    this.http.get<any>(`${this.apiBase}/me/assignments`).subscribe({
      next: (me) => {
        const active = Array.isArray(me?.active) ? me.active : [];
        this.assets = active
          .filter((a: any) => a?.asset_id != null)
          .map((a: any) => ({
            id: a.asset_id,
            asset_type: a.asset_type,
            brand: a.brand,
            model: a.model,
            status: a.asset_status ?? a.status,
          }));
        this.cdr.detectChanges();
      },
      error: () => {
        this.assets = [];
        this.cdr.detectChanges();
      },
    });
  }

  getAssetName(id: any): string {
    const asset = this.assets.find(a => a.id == id);
    return asset ? `${asset.asset_type} — ${asset.brand} ${asset.model}` : `Asset #${id}`;
  }

  assetIcon(assetId: any): string {
    const asset = this.assets.find((a) => a.id == assetId);
    const t = (asset?.asset_type || '').toLowerCase();
    if (t.includes('laptop')) return '💻';
    if (t.includes('desktop') || t.includes('workstation') || t.includes('pc')) return '🖥️';
    if (t.includes('monitor') || t.includes('display')) return '🖵';
    if (t.includes('phone')) return '📱';
    if (t.includes('printer')) return '🖨️';
    return '📦';
  }

  getRepairs() {
    this.isLoading = true;
    this.http.get<any[]>(`${this.apiBase}/repairs`).subscribe({
      next: (data) => {
        const rows = Array.isArray(data) ? data : [];
        this.normalizeRepairList(rows);
        this.repairs = rows;
        this.filteredRepairs = [...rows];
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
    this.clearFixBillInput();
    this.cdr.detectChanges();
  }

  onFixBillSelected(ev: Event) {
    const inp = ev.target as HTMLInputElement;
    const f = inp.files?.[0] ?? null;
    this.fixBillFile = f;
    this.fixBillFileName = f ? f.name : '';
    this.cdr.detectChanges();
  }

  private clearFixBillInput() {
    this.fixBillFile = null;
    this.fixBillFileName = '';
    const el = this.fixBillInput?.nativeElement;
    if (el) el.value = '';
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
    this.clearFixBillInput();
    this.cdr.detectChanges();
  }

  closeFixDialog() {
    if (this.isSavingFix) return;
    this.fixDialogRepair = null;
    this.fixDialogStep = 'ask';
    this.clearFixBillInput();
    this.cdr.detectChanges();
  }

  markFixedSkipExtras() {
    this.putFixedStatusJson();
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
    this.putFixedStatusFormData(costVal, notesVal);
  }

  /** Mark fixed without cost/notes/bill (JSON). */
  private putFixedStatusJson() {
    if (!this.fixDialogRepair) return;
    const repairId = Number(this.fixDialogRepair.id);
    this.errorMsg = '';
    this.isSavingFix = true;
    this.cdr.detectChanges();

    const url = `${this.apiBase}/repairs/update/${repairId}`;
    this.http
      .put<any>(url, { status: 'Fixed', repair_cost: null, repair_notes: null })
      .subscribe(this.markFixedSubscribeHandlers(repairId, null, null));
  }

  /**
   * Mark fixed with details — always multipart so `repair_cost` / `repair_notes` / optional file
   * are parsed reliably after multer (same as bill-only path).
   */
  private putFixedStatusFormData(repairCost: number | null, repairNotes: string | null) {
    if (!this.fixDialogRepair) return;
    const repairId = Number(this.fixDialogRepair.id);
    this.errorMsg = '';
    this.isSavingFix = true;
    this.cdr.detectChanges();

    const fd = new FormData();
    fd.append('status', 'Fixed');
    fd.append(
      'repair_cost',
      repairCost === null || repairCost === undefined ? '' : String(repairCost),
    );
    fd.append('repair_notes', repairNotes ?? '');
    if (this.fixBillFile) {
      fd.append('repair_bill', this.fixBillFile, this.fixBillFile.name);
    }

    const url = `${this.apiBase}/repairs/update/${repairId}`;
    this.http.put<any>(url, fd).subscribe(this.markFixedSubscribeHandlers(repairId, repairCost, repairNotes));
  }

  private markFixedSubscribeHandlers(
    repairId: number,
    repairCost: number | null,
    repairNotes: string | null,
  ) {
    return {
      next: (res: any) => {
        const repair = this.repairs.find((r) => r.id == repairId);
        if (repair) {
          repair.status = 'Fixed';
          repair.repair_cost = res?.repair_cost ?? repairCost;
          repair.repair_notes = res?.repair_notes ?? repairNotes;
          if (res?.fixed_at != null) repair.fixed_at = res.fixed_at;
          if (Object.prototype.hasOwnProperty.call(res ?? {}, 'repair_bill')) {
            repair.repair_bill = res.repair_bill;
          }
        }
        this.applyFilter();
        this.isSavingFix = false;
        this.fixDialogRepair = null;
        this.fixDialogStep = 'ask';
        this.clearFixBillInput();
        this.successMsg = '✅ Repair marked as Fixed';
        this.repairCostLogRefresh.notify();
        this.notifications.fetchNotifications();
        this.cdr.detectChanges();
        setTimeout(() => {
          this.successMsg = '';
          this.cdr.detectChanges();
        }, 3000);
      },
      error: (err: any) => {
        this.isSavingFix = false;
        this.errorMsg = err.error?.message || 'Failed to update status';
        this.cdr.detectChanges();
      },
    };
  }
}