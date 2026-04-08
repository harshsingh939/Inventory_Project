import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class Users implements OnInit {
  private apiUrl = 'http://localhost:3000/api/users';

  user = { name: '', employee_id: '', department: '' };
  users: any[] = [];
  filteredUsers: any[] = [];    // ✅ filtered list
  searchName = '';              // ✅ name search
  searchDept = '';              // ✅ department search
  isLoading = false;
  isAdding = false;
  errorMsg = '';
  successMsg = '';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.getUsers();
  }

  getUsers() {
    this.isLoading = true;
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.users = data;
        this.filteredUsers = data;   // ✅ initially same
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMsg = 'Failed to load users';
        this.isLoading = false;
      }
    });
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

    this.http.post<any>(this.apiUrl + '/add', this.user).subscribe({
      next: (res) => {
        const newUser = {
          name: this.user.name,
          employee_id: this.user.employee_id,
          department: this.user.department
        };
        this.users = [...this.users, newUser];
        this.applyFilter();   // ✅ filter ke saath add karo

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