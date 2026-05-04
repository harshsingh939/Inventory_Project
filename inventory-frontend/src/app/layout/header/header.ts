import {
  Component,
  OnDestroy,
  HostListener,
  Inject,
  PLATFORM_ID,
  afterNextRender
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../auth.service';
import { NotificationService } from '../../notification.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class Header implements OnDestroy {
  showDropdown = false;
  showNotifications = false;
  showLogoutPopup = false;
  /** Slide-in navigation panel */
  sidebarOpen = false;
  isBrowser: boolean;

  constructor(
    public auth: AuthService,
    public notifService: NotificationService,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    afterNextRender(() => {
      if (this.auth.isLoggedIn() && this.auth.isAdmin()) {
        this.notifService.startPolling();
      }
    });
  }

  ngOnDestroy() {
    this.notifService.stopPolling();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.isBrowser) return;
    const target = event.target as HTMLElement;
    if (!target.closest('.header-right')) {
      if (this.showNotifications) {
        this.notifService.dismissCurrent();
      }
      this.showDropdown = false;
      this.showNotifications = false;
    }
    if (this.sidebarOpen) {
      if (
        target.closest('.nav-sidebar') ||
        target.closest('.nav-menu-trigger') ||
        target.closest('.sidebar-backdrop')
      ) {
        return;
      }
      this.closeSidebar();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(ev: KeyboardEvent) {
    if (ev.key === 'Escape' && this.sidebarOpen) {
      this.closeSidebar();
    }
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
    if (this.sidebarOpen) {
      this.showDropdown = false;
      this.showNotifications = false;
    }
  }

  closeSidebar() {
    this.sidebarOpen = false;
  }

  toggleDropdown() {
    if (this.showNotifications) {
      this.notifService.dismissCurrent();
    }
    this.showDropdown = !this.showDropdown;
    this.showNotifications = false;
  }

  toggleNotifications() {
    const wasOpen = this.showNotifications;
    this.showNotifications = !this.showNotifications;
    this.showDropdown = false;
    if (wasOpen) {
      this.notifService.dismissCurrent();
    }
  }

  closeNotificationsForNav() {
    if (this.showNotifications) {
      this.notifService.markAllRead();
    }
    this.showNotifications = false;
  }

  logout() {
    this.showDropdown = false;
    this.showLogoutPopup = true;
    setTimeout(() => {
      this.auth.logout();
      this.notifService.stopPolling();
      this.notifService.resetDismissed();
      this.showLogoutPopup = false;
      this.router.navigate(['/login']);
    }, 2000);
  }

  get initial(): string  { return this.auth.getInitial(); }
  get profile()          { return this.auth.getProfile(); }
  get isLoggedIn(): boolean { return this.auth.isLoggedIn(); }
  get isAdmin(): boolean    { return this.auth.isAdmin(); }

  timeAgo(dateStr: string | undefined): string {
    if (!dateStr) return 'Recently';
    const now  = new Date();
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
  }
}