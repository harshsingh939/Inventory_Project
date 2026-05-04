import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../api-url';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class Users implements OnInit {
  private readonly usersUrl = apiUrl('users');

  user = { name: '', employee_id: '', department: '' };
  users: any[] = [];
  filteredUsers: any[] = [];
  searchName = '';
  searchDept = '';
  searchEmpId = '';
  sortField = '';
  sortDir: 'asc' | 'desc' = 'asc';
  nameSuggestions: string[] = [];
  showSuggestions = false;
  isLoading = false;
  isAdding = false;
  errorMsg = '';
  successMsg = '';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() { this.getUsers(); }

  getUsers() {
    this.isLoading = true;
    this.http.get<any[]>(this.usersUrl).subscribe({
      next: (data) => {
        this.users = data;
        this.filteredUsers = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMsg = 'Failed to load users';
        this.isLoading = false;
      }
    });
  }

  setSort(field: string) {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir = 'asc';
    }
    this.applyFilter();
  }

  toggleSortDir() {
    this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    this.applyFilter();
  }

  applyFilter() {
    const name = this.searchName.toLowerCase().trim();
    const dept = this.searchDept.toLowerCase().trim();
    const empId = this.searchEmpId.toLowerCase().trim();

    this.nameSuggestions = name
      ? [...new Set(this.users
          .map(u => u.name)
          .filter(n => n.toLowerCase().startsWith(name)))]
        .slice(0, 8)
      : [];

    let result = this.users.filter(u => {
      const matchName  = name  ? u.name.toLowerCase().includes(name)         : true;
      const matchDept  = dept  ? u.department.toLowerCase().includes(dept)   : true;
      const matchEmpId = empId ? u.employee_id.toLowerCase().includes(empId) : true;
      return matchName && matchDept && matchEmpId;
    });

    if (this.sortField) {
      const dir = this.sortDir === 'asc' ? 1 : -1;
      result = [...result].sort((a, b) => {
        const av = (a[this.sortField] ?? '').toLowerCase();
        const bv = (b[this.sortField] ?? '').toLowerCase();
        return av < bv ? -dir : av > bv ? dir : 0;
      });
    }

    this.filteredUsers = result;
    this.cdr.detectChanges();
  }

  selectSuggestion(name: string) {
    this.searchName = name;
    this.showSuggestions = false;
    this.applyFilter();
  }

  hideSuggestions() {
    setTimeout(() => { this.showSuggestions = false; }, 150);
  }

  clearFilter() {
    this.searchName = '';
    this.searchDept = '';
    this.searchEmpId = '';  // ✅ fixed — was missing
    this.sortField = '';
    this.sortDir = 'asc';
    this.nameSuggestions = [];
    this.showSuggestions = false;
    this.filteredUsers = [...this.users];
    this.cdr.detectChanges();
  }

  addUser() {
    if (!this.user.name.trim())        { this.errorMsg = 'Name is required';        return; }
    if (!this.user.employee_id.trim()) { this.errorMsg = 'Employee ID is required'; return; }
    if (!this.user.department.trim())  { this.errorMsg = 'Department is required';  return; }

    const exists = this.users.find(
      u => u.employee_id.toLowerCase() === this.user.employee_id.toLowerCase()
    );
    if (exists) {
      this.errorMsg = `Employee ID "${this.user.employee_id}" already exists!`;
      return;
    }

    this.errorMsg = '';
    this.successMsg = '';
    this.isAdding = true;

    this.http.post<any>(this.usersUrl + '/add', this.user).subscribe({
      next: () => {
        const newUser = { ...this.user };
        this.users = [...this.users, newUser];
        this.applyFilter();
        this.isAdding = false;
        this.successMsg = '✅ User added successfully!';
        this.user = { name: '', employee_id: '', department: '' };
        this.cdr.detectChanges();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => {
        this.isAdding = false;
        this.errorMsg = err.error?.message || 'Failed to add user';
        this.cdr.detectChanges();
      }
    });
  }
}