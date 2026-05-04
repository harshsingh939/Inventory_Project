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

  users:            any[] = [];
  availableAssets:  any[] = [];
  activeAssignments: any[] = [];
  allAssignments:   any[] = [];
  filteredAssignments: any[] = [];

  selectedUserId  = '';
  selectedAssetId = '';
  conditionBefore = 'Good';
  // 🔽 ADD THIS
groupedEmployees: any[] = [];
filteredEmployees: any[] = [];
employeeSearch: string = '';
  historySearchName  = '';
  historySearchAsset = '';

  isLoading   = false;
  isAssigning = false;
  errorMsg    = '';
  successMsg  = '';
  assetLoadError = '';
  assetLoadHint  = '';
  activeTab = 'active';
  /** Active tab: sort order for assignment cards */
  activeSortKey: 'start_desc' | 'start_asc' | 'employee' | 'asset' = 'start_desc';
  /** Active tab: same data as `activeAssignments`, sorted for display */
  activeAssignmentsOrdered: any[] = [];

  /** Overview: checked-out vs remaining (no open assignments) roster; `holding` = assets with staff */
  overviewPeopleFilter: 'holding' | 'remaining' = 'holding';

  empSearchName = '';
empSearchAsset = '';
filteredEmployeeHistory: any[] = [];


  // Employee History Modal
  selectedEmployee: any = null;
  employeeHistory: any[] = [];
  employeeActiveAssignments: any[] = [];
  isEmployeeModalOpen = false;
  isLoadingEmployeeHistory = false;
  showDropdown: boolean = false;
  // Clearance Check
clearanceSearch = '';
clearanceEmployee: any = null;
clearanceActiveAssets: any[] = [];
clearanceFilteredEmployees: any[] = [];
showClearanceDropdown = false;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.isLoading = true;
    this.assetLoadError = '';
    this.assetLoadHint = '';

    this.http.get<any[]>(`${this.apiBase}/users`).subscribe({
      next: (data) => {
        this.users = data;
        this.groupEmployees();
        this.cdr.detectChanges();
      }
    });

    this.http.get<any[]>(`${this.apiBase}/assets/available`).subscribe({
      next: (data) => {
        const raw = Array.isArray(data) ? data : [];
        const allow = sessionAssignableTypeSet();
        const filtered = raw.filter(a => allow.has(sessionAssetTypeKey(a.asset_type)));
        if (filtered.length === 0 && raw.length > 0) {
          this.availableAssets = raw;
          this.assetLoadHint = 'Some assets use a custom type name; showing all free assets from the server.';
        } else {
          this.availableAssets = filtered;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.assetLoadError =
          err.error?.message ||
          (typeof err.error === 'string' ? err.error : null) ||
          'Could not load available assets.';
        this.availableAssets = [];
        this.cdr.detectChanges();
      }
    });

    this.http.get<any[]>(`${this.apiBase}/sessions/active`).subscribe({
      next: (data) => {
        this.activeAssignments = data;
        this.reorderActiveAssignments();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isLoading = false; }
    });

    this.http.get<any[]>(`${this.apiBase}/sessions/all`).subscribe({
      next: (data) => {
        this.allAssignments = data;
        this.filteredAssignments = data;
        this.groupEmployees();


        this.applyHistoryFilter();
        this.cdr.detectChanges();
      }
    });
  }
  

 applyHistoryFilter() {
  const name  = this.historySearchName.toLowerCase().trim();
  const asset = this.historySearchAsset.toLowerCase().trim();

  this.filteredAssignments = this.allAssignments.filter(a => {
    const matchName = name
      ? a.user_name?.toLowerCase().includes(name) ||
        a.employee_id?.toLowerCase().includes(name)
      : true;
    const matchAsset = asset
      ? `${a.asset_type} ${a.brand} ${a.model}`.toLowerCase().includes(asset)
      : true;
    return matchName && matchAsset;
  });

  this.cdr.detectChanges();
}

applyEmployeeHistoryFilter() {
  const name  = this.empSearchName.toLowerCase().trim();
  const asset = this.empSearchAsset.toLowerCase().trim();

  this.filteredEmployeeHistory = this.employeeHistory.filter(a => {
    const matchName = name
      ? a.user_name?.toLowerCase().includes(name) ||
        a.employee_id?.toLowerCase().includes(name)
      : true;
    const matchAsset = asset
      ? `${a.asset_type} ${a.brand} ${a.model}`.toLowerCase().includes(asset)
      : true;
    return matchName && matchAsset;
  });

  this.cdr.detectChanges();
}

clearEmployeeHistoryFilter() {
  this.empSearchName = '';
  this.empSearchAsset = '';
  this.filteredEmployeeHistory = [...this.employeeHistory];
  this.cdr.detectChanges();
}
  clearHistoryFilter() {
    this.historySearchName  = '';
    this.historySearchAsset = '';
    this.filteredAssignments = [...this.allAssignments];
    this.cdr.detectChanges();
  }
  
groupEmployees() {
  if (!this.allAssignments || !Array.isArray(this.allAssignments)) {
    this.groupedEmployees = [];
    this.filteredEmployees = [];
    return;
  }

  const map = new Map<string, any>();

  this.allAssignments.forEach(a => {
    const key = a?.employee_id;

    if (!key) return;

    if (!map.has(key)) {
      map.set(key, {
        user_name: a.user_name || 'Unknown',
        employee_id: key,
        department: a.department || '',
        total: 0
      });
    }

    map.get(key).total++;
  });

  (this.users || []).forEach((u: any) => {
    const key = u?.employee_id;
    if (!key || map.has(key)) return;
    map.set(key, {
      user_name: u.name || 'Unknown',
      employee_id: key,
      department: u.department || '',
      total: 0
    });
  });

  this.groupedEmployees = Array.from(map.values()).sort((a, b) =>
    (a.user_name || '').localeCompare(b.user_name || '', undefined, { sensitivity: 'base' })
  );
  this.filteredEmployees = [...this.groupedEmployees];

  this.cdr.detectChanges();
}
applyEmployeeSearch() {
  const text = this.employeeSearch.toLowerCase().trim();

  if (!text) {
    this.filteredEmployees = [];
    this.showDropdown = false;
    return;
  }

  this.filteredEmployees = this.groupedEmployees.filter(emp =>
    (emp.user_name || '').toLowerCase().includes(text) ||
    (emp.employee_id || '').toLowerCase().includes(text)
  );

  this.showDropdown = true;
}

  clearEmployeeDetailsSearch() {
    this.employeeSearch = '';
    this.showDropdown = false;
    this.filteredEmployees = [];
    this.selectedEmployee = null;
    this.employeeHistory = [];
    this.filteredEmployeeHistory = [];
    this.employeeActiveAssignments = [];
    this.empSearchName = '';
    this.empSearchAsset = '';
    this.cdr.detectChanges();
  }

  reorderActiveAssignments() {
    const list = [...(this.activeAssignments || [])];
    const cmp = (x: string, y: string) =>
      (x || '').localeCompare(y || '', undefined, { sensitivity: 'base' });
    const assetLabel = (a: any) =>
      `${a.asset_type || ''} ${a.brand || ''} ${a.model || ''}`.trim();

    switch (this.activeSortKey) {
      case 'start_asc':
        list.sort(
          (a, b) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );
        break;
      case 'employee':
        list.sort(
          (a, b) =>
            cmp(a.user_name, b.user_name) ||
            cmp(String(a.employee_id ?? ''), String(b.employee_id ?? ''))
        );
        break;
      case 'asset':
        list.sort((a, b) => cmp(assetLabel(a), assetLabel(b)));
        break;
      case 'start_desc':
      default:
        list.sort(
          (a, b) =>
            new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
        );
    }
    this.activeAssignmentsOrdered = list;
  }

  assignAsset() {
    if (!this.selectedUserId)  { this.errorMsg = 'Please select a user';  return; }
    if (!this.selectedAssetId) { this.errorMsg = 'Please select an asset'; return; }

    this.errorMsg = '';
    this.successMsg = '';
    this.isAssigning = true;

    this.http.post<any>(`${this.apiBase}/sessions/start`, {
      user_id:          this.selectedUserId,
      asset_id:         this.selectedAssetId,
      condition_before: this.conditionBefore
    }).subscribe({
      next: () => {
        this.isAssigning = false;
        this.successMsg = '✅ Asset assigned successfully!';
        this.selectedUserId  = '';
        this.selectedAssetId = '';
        this.conditionBefore = 'Good';
        this.loadAll();
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

  /** Active rows for a user id (assign form / exit check). */
  activeAssignmentsForUserId(userId: string | number | null | undefined): any[] {
    if (userId === null || userId === undefined || userId === '') return [];
    return this.activeAssignments.filter(a => String(a.user_id) === String(userId));
  }

  /** Summary for whether any assignments remain out, in the assign form. */
  getSelectedUserReturnStatus(): { count: number; allReturned: boolean } | null {
    if (!this.selectedUserId) return null;
    const list = this.activeAssignmentsForUserId(this.selectedUserId);
    return { count: list.length, allReturned: list.length === 0 };
  }

  getUserName(id: string): string {
    const user = this.users.find(u => u.id == id);
    return user ? user.name : '';
  }

  getAssetName(id: string): string {
    const asset = this.availableAssets.find(a => a.id == id);
    return asset ? `${asset.asset_type} - ${asset.brand}` : '';
  }

  formatDuration(minutes: number): string {
    if (!minutes && minutes !== 0) return '—';
    const totalSeconds = Math.round(minutes * 60);
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    const parts: string[] = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);
    return parts.join(' ');
  }
  selectEmployee(emp: any) {
    this.employeeSearch = `${emp.user_name} (${emp.employee_id})`;
    this.showDropdown = false;
    this.openEmployeeHistory(emp);
  }
hideDropdown() {
  setTimeout(() => {
    this.showDropdown = false;
  }, 200);
}

  openEmployeeHistory(employee: any) {
    const eid = employee?.employee_id;
    if (!eid) return;

    this.selectedEmployee = {
      user_name: employee.user_name || employee.name || 'Unknown',
      employee_id: eid,
      department: employee.department || ''
    };
    this.activeTab = 'employee';

    const rows = this.allAssignments.filter(a => a.employee_id === eid);
    this.employeeHistory = [...rows].sort((x, y) => {
      const tx = new Date(x.start_time).getTime();
      const ty = new Date(y.start_time).getTime();
      return ty - tx;
    });
    this.filteredEmployeeHistory = [...this.employeeHistory];

    this.employeeActiveAssignments = this.activeAssignments.filter(a =>
      a.employee_id === eid
    );

    this.cdr.detectChanges();
  }

  closeEmployeeModal() {
    this.isEmployeeModalOpen = false;
    this.selectedEmployee = null;
    this.employeeHistory = [];
    this.employeeActiveAssignments = [];
    this.cdr.detectChanges();
  }

  getEmployeeStats(history: any[]) {
    const total = history.length;
    const completed = history.filter(a => a.status === 'Completed').length;
    const active = history.filter(a => a.status === 'Active').length;
    const totalMinutes = history
      .filter(a => a.working_minutes)
      .reduce((sum, a) => sum + a.working_minutes, 0);
    return { total, completed, active, totalMinutes };
  }

  employeesWithOpenAssets(): any[] {
    const map = new Map<string, any>();
    this.activeAssignments.forEach(a => {
      const key = a.employee_id;
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          user_name: a.user_name,
          employee_id: key,
          department: a.department || '',
          assets: []
        });
      }
      map.get(key).assets.push(a);
    });
    return Array.from(map.values()).sort((a, b) =>
      (a.user_name || '').localeCompare(b.user_name || '', undefined, { sensitivity: 'base' })
    );
  }

  employeesFullyCleared(): any[] {
    const holdingIds = new Set(
      this.activeAssignments
        .map(a => a?.employee_id)
        .filter((id): id is string | number => id !== null && id !== undefined && `${id}` !== '')
        .map(id => String(id))
    );
    return this.groupedEmployees.filter(emp => !holdingIds.has(String(emp.employee_id)));
  }
}