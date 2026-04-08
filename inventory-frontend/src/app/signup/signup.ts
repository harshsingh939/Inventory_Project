import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.css'
})
export class Signup {
  username = '';
  mobile = '';
  email = '';
  password = '';
  confirmPassword = '';
  showPassword = false;
  showConfirm = false;
  signupError = '';
  signupSuccess = '';
  isLoading = false;

  constructor(private router: Router, private auth: AuthService) {}

  onSignup() {
    this.signupError = '';
    this.signupSuccess = '';

    if (!this.username.trim()) {
      this.signupError = 'Username is required';
      return;
    }

    if (!this.email.trim()) {
      this.signupError = 'Email is required';
      return;
    }

    if (!this.mobile.trim() || this.mobile.length !== 10) {
      this.signupError = 'Enter valid 10-digit mobile number';
      return;
    }

    if (this.password.length < 6) {
      this.signupError = 'Password must be at least 6 characters';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.signupError = 'Passwords do not match';
      return;
    }

    this.isLoading = true;

    this.auth.signup({
      username: this.username,
      email: this.email,
      mobile: this.mobile,
      password: this.password
    }).subscribe({
      next: () => {
        this.isLoading = false;
        this.signupSuccess = 'Account created! Redirecting to login...';
        setTimeout(() => this.router.navigate(['/login']), 1500);
      },
      error: (err) => {
        this.isLoading = false;
        this.signupError = err.error?.message || 'Signup failed. Try again.';
      }
    });
  }
}