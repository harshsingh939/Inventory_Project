import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { ChangeDetectorRef } from '@angular/core';
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  identifier = '';
  password = '';
  showPassword = false;
  loginError = '';
  showSuccess = false;
  isLoading = false;

  constructor(private router: Router, private auth: AuthService,  private cd: ChangeDetectorRef) {}

  onLogin() {
    this.loginError = '';

    if (!this.identifier.trim()) {
      this.loginError = 'Please enter your email or phone';
      return;
    }

    if (!this.password.trim() || this.password.length < 6) {
      this.loginError = 'Password must be at least 6 characters';
      return;
    }

    this.isLoading = true;

    this.auth.login(this.identifier.trim(), this.password.trim()).subscribe({
      next: () => {
        this.isLoading = false;
        this.showSuccess = true;      // ✅ show popup immediately
        setTimeout(() => {
          this.showSuccess = false;
          this.router.navigate(['/']);
        }, 2000);                     // ✅ 2 seconds then redirect
      },
     error: (err) => {
  this.isLoading = false;

  console.log("ERROR BODY:", err.error);

  this.loginError = err.error?.message || "User not found";

  this.cd.detectChanges();   // 🔥 FORCE UI UPDATE
} });
  }
}