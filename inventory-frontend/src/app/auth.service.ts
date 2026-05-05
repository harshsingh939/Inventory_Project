import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Inject } from '@angular/core';
import { apiUrl } from './api-url';

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  mobile: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authBase = apiUrl('auth');
  private isBrowser: boolean;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);  // ✅ check if browser
  }

  login(identifier: string, password: string): Observable<any> {
    return this.http.post(`${this.authBase}/login`, { identifier, password }).pipe(
      tap((res: any) => {
        if (this.isBrowser) {
          sessionStorage.setItem('token', res.token);
          sessionStorage.setItem('user', JSON.stringify(res.user));
        }
      })
    );
  }

  signup(data: {
    username: string;
    email: string;
    mobile: string;
    password: string;
  }): Observable<any> {
    return this.http.post(`${this.authBase}/signup`, data);
  }

  logout() {
    if (this.isBrowser) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
    }
  }

  isLoggedIn(): boolean {
    if (!this.isBrowser) return false;   // ✅ SSR safe
    return !!sessionStorage.getItem('token');
  }

  getToken(): string | null {
    if (!this.isBrowser) return null;
    return sessionStorage.getItem('token');
  }

  getProfile(): UserProfile | null {
    if (!this.isBrowser) return null;
    const data = sessionStorage.getItem('user');
    return data ? JSON.parse(data) : null;
  }

  getInitial(): string {
    const profile = this.getProfile();
    return profile ? profile.username.charAt(0).toUpperCase() : '?';
  }

  getAuthHeaders() {
    const token = this.getToken();
    return {
      headers: new HttpHeaders({
        'Authorization': `Bearer ${token}`
      })
    };
  }
  getRole(): string {
  const profile = this.getProfile();
  return profile ? (profile as any).role || 'user' : 'user';
}

isAdmin(): boolean {
  return this.getRole() === 'admin';
}

/** Repair vendor / in-house technician login (separate panel) */
isRepairAuthority(): boolean {
  return this.getRole() === 'repair_authority';
}
getUserId(): number | null {
  const profile = this.getProfile();
  return profile ? profile.id : null;
}
}