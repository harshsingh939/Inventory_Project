import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { of, Subscription } from 'rxjs';
import { catchError, filter } from 'rxjs/operators';
import { apiUrl } from '../api-url';
import { AuthService } from '../auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { TeamSignupPrefillService } from '../team-signup-prefill.service';
import { subRolesForDepartment } from '../department-sub-roles';

export interface UserRowDraft {
  department: string;
  sub_role: string;
  auth_user_id: string;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class Users implements OnInit, OnDestroy {
  private readonly usersUrl = apiUrl('users');

  /** Keep in sync with Inventory_backend/constants/departments.js; sub-roles in `department-sub-roles.ts`. */
  readonly departmentOptions: readonly string[] = [
    'IT',
    'Telecommunications',
    'HR',
    'Finance',
    'Operations',
    'Engineering',
    'Facilities',
    'Administration',
  ];

  user = { name: '', employee_id: '', department: '', sub_role: '', auth_user_id: '' };
  users: any[] = [];
  filteredUsers: any[] = [];    // ✅ filtered list
  searchName = '';              // ✅ name search
  searchDept = '';              // ✅ department search
  isLoading = false;
  isAdding = false;
  errorMsg = '';
  successMsg = '';
  /** Admin: editable directory row draft (department, sub-role, login id). */
  rowDraft: Record<number, UserRowDraft> = {};
  savingLinkId: number | null = null;
  private prefillSub?: Subscription;
  private navSub?: Subscription;
  /**
   * Login id from "New account" notification while the add row is locked.
   * Disabled inputs + ngModel can fail to keep values; this guarantees the POST includes auth_user_id.
   */
  private capturedSignupAuthUserId: number | null = null;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private auth: AuthService,
    private router: Router,
    private teamSignupPrefill: TeamSignupPrefillService,
  ) {}

  get isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  get isRepairAuthority(): boolean {
    return this.auth.isRepairAuthority();
  }

  get nameFieldLockedFromSignup(): boolean {
    return this.teamSignupPrefill.nameLocked();
  }

  /** Sub-role dropdown options for the Add form from the selected department. */
  addFormSubRoleOptions(): readonly string[] {
    return subRolesForDepartment(this.user.department);
  }

  /** Options for a table row’s department. */
  subRoleOptionsForDept(dept: string): readonly string[] {
    return subRolesForDepartment(dept);
  }

  onAddFormDepartmentChange() {
    const opts = this.addFormSubRoleOptions();
    if (this.user.sub_role && !opts.includes(this.user.sub_role)) {
      this.user.sub_role = '';
    }
  }

  onRowDepartmentChange(rowId: number) {
    const d = this.rowDraft[rowId];
    if (!d) return;
    const opts = subRolesForDepartment(d.department);
    if (d.sub_role && !opts.includes(d.sub_role)) {
      d.sub_role = '';
    }
  }

  ngOnInit() {
    if (this.auth.isLoggedIn() && !this.auth.isAdmin() && !this.auth.isRepairAuthority()) {
      void this.router.navigate(['/my-profile'], { replaceUrl: true });
      return;
    }
    this.prefillSub = this.teamSignupPrefill.apply$.subscribe(() => this.applySignupPrefill());
    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        if (e.urlAfterRedirects.split('?')[0] === '/users') {
          this.applySignupPrefill();
        }
      });
    this.refreshMeAndList();
    this.applySignupPrefill();
  }

  ngOnDestroy() {
    this.prefillSub?.unsubscribe();
    this.navSub?.unsubscribe();
    this.capturedSignupAuthUserId = null;
    this.teamSignupPrefill.abandonOnLeaveUsersPage();
  }

  /** Fill name + login id from notification buffer; read-only state via {@link TeamSignupPrefillService}. */
  private applySignupPrefill() {
    if (!this.isAdmin) return;
    const d = this.teamSignupPrefill.takeDraft();
    if (!d) return;
    this.capturedSignupAuthUserId = d.authUserId;
    this.user.name = d.name;
    this.user.auth_user_id = String(d.authUserId);
    this.cdr.detectChanges();
  }

  /** Load full users list */
  refreshMeAndList() {
    this.isLoading = true;
    this.errorMsg = '';
    this.http
      .get<any[]>(this.usersUrl)
      .pipe(catchError(() => of([])))
      .subscribe({
        next: (list) => {
          const rows = Array.isArray(list) ? list : [];
          this.users = this.scopeUsersForCurrentLogin(rows);
          this.rebuildRowDraft();
          this.applyFilter();
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.errorMsg = 'Failed to load directory data';
          this.isLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

  /** Client-side safety: non-admin should only see rows linked to current auth login. */
  private scopeUsersForCurrentLogin(rows: any[]): any[] {
    if (this.isAdmin) {
      return rows;
    }
    const authUserId = this.auth.getUserId();
    if (!Number.isFinite(Number(authUserId))) {
      return [];
    }
    return rows.filter((u: any) => Number(u?.auth_user_id) === Number(authUserId));
  }

  rebuildRowDraft() {
    this.rowDraft = {};
    (this.users || []).forEach((u: any) => {
      this.rowDraft[u.id] = {
        department: String(u.department ?? ''),
        sub_role: String(u.sub_role ?? ''),
        auth_user_id:
          u.auth_user_id != null && u.auth_user_id !== '' ? String(u.auth_user_id) : '',
      };
    });
  }

  getUsers() {
    this.refreshMeAndList();
  }

  // ✅ search filter
  applyFilter() {
    const name = this.searchName.toLowerCase().trim();
    const dept = this.searchDept.toLowerCase().trim();

    this.filteredUsers = this.users.filter(u => {
      const matchName = name ? u.name.toLowerCase().includes(name) : true;
      const matchDept = dept
        ? `${u.department} ${u.sub_role || ''}`.toLowerCase().includes(dept)
        : true;
      return matchName && matchDept;
    });

    this.cdr.detectChanges();
  }

  // ✅ clear filters
  clearFilter() {
    this.searchName = '';
    this.searchDept = '';
    this.filteredUsers = [...this.users];
    this.cdr.detectChanges();
  }

  addUser() {
    if (!this.isAdmin) return;
    if (!this.user.name.trim()) {
      this.errorMsg = 'Name is required'; return;
    }
    if (!this.user.employee_id.trim()) {
      this.errorMsg = 'Employee ID is required'; return;
    }
    if (!this.user.department.trim()) {
      this.errorMsg = 'Choose a department'; return;
    }
    if (!this.user.sub_role.trim()) {
      this.errorMsg = 'Choose a sub-role'; return;
    }
    const subOpts = subRolesForDepartment(this.user.department);
    if (!subOpts.includes(this.user.sub_role.trim())) {
      this.errorMsg = 'Sub-role must match the selected department'; return;
    }

    const exists = this.users.find(
      (u) => u.employee_id.toLowerCase() === this.user.employee_id.toLowerCase()
    );
    if (exists) {
      this.errorMsg = `Employee ID "${this.user.employee_id}" already exists!`;
      return;
    }

    this.errorMsg = '';
    this.successMsg = '';
    this.isAdding = true;

    const locked = this.teamSignupPrefill.nameLocked();
    const linkRaw =
      locked && this.capturedSignupAuthUserId != null
        ? String(this.capturedSignupAuthUserId)
        : String(this.user.auth_user_id ?? '').trim();
    const payload: {
      name: string;
      employee_id: string;
      department: string;
      sub_role: string;
      auth_user_id?: number;
    } = {
      name: this.user.name.trim(),
      employee_id: this.user.employee_id.trim(),
      department: this.user.department.trim(),
      sub_role: this.user.sub_role.trim(),
    };
    if (linkRaw !== '') {
      const aid = Number(linkRaw);
      if (!Number.isFinite(aid)) {
        this.isAdding = false;
        this.errorMsg = 'Login user id must be a number';
        this.cdr.detectChanges();
        return;
      }
      payload.auth_user_id = aid;
    }

    this.http.post<any>(`${this.usersUrl}/add`, payload).subscribe({
      next: (res) => {
        this.isAdding = false;
        this.successMsg = res?.message || 'User added successfully!';
        this.user = { name: '', employee_id: '', department: '', sub_role: '', auth_user_id: '' };
        this.capturedSignupAuthUserId = null;
        this.teamSignupPrefill.unlockNameField();
        this.refreshMeAndList();
        this.cdr.detectChanges();
        setTimeout(() => {
          this.successMsg = '';
          this.cdr.detectChanges();
        }, 3500);
      },
      error: (err) => {
        this.isAdding = false;
        this.errorMsg = err.error?.message || 'Failed to add employee';
        this.cdr.detectChanges();
      },
    });
  }

  saveUserRow(u: any) {
    if (!this.isAdmin) return;
    const d = this.rowDraft[u.id];
    if (!d) return;
    const dept = String(d.department ?? '').trim();
    const sub = String(d.sub_role ?? '').trim();
    const rawAuth = String(d.auth_user_id ?? '').trim();
    if (!dept) {
      this.errorMsg = 'Choose a department';
      this.cdr.detectChanges();
      return;
    }
    if (!sub) {
      this.errorMsg = 'Choose a sub-role';
      this.cdr.detectChanges();
      return;
    }
    const subOpts = subRolesForDepartment(dept);
    if (!subOpts.includes(sub)) {
      this.errorMsg = 'Sub-role must match the department';
      this.cdr.detectChanges();
      return;
    }
    const authVal = rawAuth === '' ? null : Number(rawAuth);
    if (authVal !== null && !Number.isFinite(authVal)) {
      this.errorMsg = 'Login user id must be a number';
      this.cdr.detectChanges();
      return;
    }
    this.errorMsg = '';
    this.savingLinkId = u.id;
    const payload = {
      department: dept,
      sub_role: sub,
      auth_user_id: authVal,
    };
    this.http.put<any>(`${this.usersUrl}/${u.id}`, payload).subscribe({
      next: () => {
        this.savingLinkId = null;
        u.department = dept;
        u.sub_role = sub;
        u.auth_user_id = authVal;
        this.rebuildRowDraft();
        this.successMsg = 'Row saved ✅';
        this.cdr.detectChanges();
        setTimeout(() => {
          this.successMsg = '';
          this.cdr.detectChanges();
        }, 2500);
      },
      error: (err) => {
        this.savingLinkId = null;
        this.errorMsg = err.error?.message || 'Update failed';
        this.cdr.detectChanges();
      },
    });
  }
}