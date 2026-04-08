import { Component, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SidebarService } from '../sidebar/sidebar.service';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class Header {
  showDropdown = false;
  showLogoutPopup = false;
  isBrowser: boolean;

  constructor(
    private sidebarService: SidebarService,
    public auth: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.isBrowser) return;   // ✅ SSR safe
    const target = event.target as HTMLElement;
    if (!target.closest('.header-right')) {
      this.showDropdown = false;
    }
  }

  toggleSidebar() {
    this.sidebarService.toggle();
  }

  toggleDropdown() {
    this.showDropdown = !this.showDropdown;
  }

  logout() {
    this.showDropdown = false;
    this.showLogoutPopup = true;

    setTimeout(() => {
      this.auth.logout();
      this.showLogoutPopup = false;
      this.router.navigate(['/login']);
    }, 2000);
  }

  get initial(): string {
    return this.auth.getInitial();
  }

  get profile() {
    return this.auth.getProfile();
  }

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }
}