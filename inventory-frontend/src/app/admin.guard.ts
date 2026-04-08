import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (this.auth.isLoggedIn() && this.auth.isAdmin()) {
      return true;
    }
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
    } else {
      this.router.navigate(['/not-authorized']);
    }
    return false;
  }
}