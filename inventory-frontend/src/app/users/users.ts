import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { apiUrl } from '../api-url';
import { AuthService } from '../auth.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class Users implements OnInit {
  private readonly usersUrl = apiUrl('users');

  user = { name: '', employee_id: '', department: '' };
  users: any[] = [];
  filteredUsers: any[] = [];    // ✅ filtered list
  searchName = '';              // ✅ name search
  searchDept = '';              // ✅ department search
  isLoading = false;
  isAdding = false;
  errorMsg = '';
  successMsg = '';
  /** Admin: map users.id → auth_users.id for login-linked workspace */
  linkDraft: Record<number, string> = {};
  savingLinkId: number | null = null;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private auth: AuthService,
  ) {}

  get isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  ngOnInit() {
    this.refreshMeAndList();
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
          this.users = Array.isArray(list) ? list : [];
          this.rebuildLinkDraft();
          this.applyFilter();
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.errorMsg = 'Failed to load users';
          this.isLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

  rebuildLinkDraft() {
    this.linkDraft = {};
    (this.users || []).forEach((u: any) => {
      if (u.auth_user_id != null && u.auth_user_id !== '') {
        this.linkDraft[u.id] = String(u.auth_user_id);
      } else {
        this.linkDraft[u.id] = '';
      }
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
      const matchDept = dept ? u.department.toLowerCase().includes(dept) : true;
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
    if (!this.user.name.trim()) {
      this.errorMsg = 'Name is required'; return;
    }
    if (!this.user.employee_id.trim()) {
      this.errorMsg = 'Employee ID is required'; return;
    }
    if (!this.user.department.trim()) {
      this.errorMsg = 'Department is required'; return;
    }

    /** Admin bulk-add: unlinked directory rows. Logged-in non-admin: must use /me/employee so auth_user_id is set (My workspace “linked”). */
    const selfRegister = this.isLoggedIn && !this.isAdmin;
    if (!selfRegister) {
      const exists = this.users.find(
        (u) => u.employee_id.toLowerCase() === this.user.employee_id.toLowerCase()
      );
      if (exists) {
        this.errorMsg = `Employee ID "${this.user.employee_id}" already exists!`;
        return;
      }
    }

    this.errorMsg = '';
    this.successMsg = '';
    this.isAdding = true;

    const url = selfRegister ? apiUrl('me/employee') : `${this.usersUrl}/add`;

    this.http.post<any>(url, this.user).subscribe({
      next: (res) => {
        this.isAdding = false;
        this.successMsg = selfRegister
          ? (res?.message || 'Profile saved. My workspace will recognize your account.')
          : 'User added successfully!';
        this.user = { name: '', employee_id: '', department: '' };
        this.refreshMeAndList();
        this.cdr.detectChanges();
        setTimeout(() => {
          this.successMsg = '';
          this.cdr.detectChanges();
        }, 3500);
      },
      error: (err) => {
        this.isAdding = false;
        if (selfRegister && err?.status === 409) {
          this.successMsg = err.error?.message || 'Your profile is already linked.';
          this.user = { name: '', employee_id: '', department: '' };
          this.refreshMeAndList();
          this.cdr.detectChanges();
          setTimeout(() => {
            this.successMsg = '';
            this.cdr.detectChanges();
          }, 3500);
          return;
        }
        this.errorMsg = err.error?.message || 'Failed to add user';
        this.cdr.detectChanges();
      },
    });
  }

  saveAuthLink(u: any) {
    if (!this.isAdmin) return;
    const raw = (this.linkDraft[u.id] ?? '').trim();
    const payload: { auth_user_id: number | null } = {
      auth_user_id: raw === '' ? null : Number(raw),
    };
    if (payload.auth_user_id !== null && !Number.isFinite(payload.auth_user_id)) {
      this.errorMsg = 'Auth user id must be a number (from auth_users.id)';
      this.cdr.detectChanges();
      return;
    }
    this.errorMsg = '';
    this.savingLinkId = u.id;
    this.http.put<any>(`${this.usersUrl}/${u.id}`, payload).subscribe({
      next: () => {
        this.savingLinkId = null;
        u.auth_user_id = payload.auth_user_id;
        this.successMsg = 'Login link saved ✅';
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