import {
  Component,
  OnDestroy,
  OnInit,
  HostListener,
  Inject,
  PLATFORM_ID,
  afterNextRender
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../auth.service';
import { NotificationService, type Notification } from '../../notification.service';
import { EmployeeProfileStatusService } from '../../employee-profile-status.service';
import { TeamSignupPrefillService } from '../../team-signup-prefill.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class Header implements OnInit, OnDestroy {
  showDropdown = false;
  showNotifications = false;
  showLogoutPopup = false;
  /** Slide-in navigation panel */
  sidebarOpen = false;
  isBrowser: boolean;
  private navSub?: Subscription;

  constructor(
    public auth: AuthService,
    public notifService: NotificationService,
    public employeeProfile: EmployeeProfileStatusService,
    private teamSignupPrefill: TeamSignupPrefillService,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    afterNextRender(() => {
      this.syncAdminNotifications();
    });
  }

  ngOnInit() {
    this.syncAdminNotifications();
    this.syncEmployeeProfileNav();
    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        this.syncAdminNotifications();
        this.syncEmployeeProfileNav();
      });
  }

  /** Start repair alerts polling once session shows an admin (covers SSR/hydration timing). */
  private syncAdminNotifications() {
    if (!this.isBrowser) return;
    if (this.auth.isLoggedIn() && this.auth.isAdmin()) {
      this.notifService.startPolling();
    } else {
      this.notifService.stopPolling();
    }
  }

  /** Employee: refresh linked-profile flag (gates Home link + marketing home redirect). */
  private syncEmployeeProfileNav() {
    if (!this.isBrowser) return;
    if (this.auth.isLoggedIn() && !this.auth.isAdmin() && !this.auth.isRepairAuthority()) {
      this.employeeProfile.refresh().subscribe({ error: () => {} });
    } else if (!this.auth.isLoggedIn()) {
      this.employeeProfile.reset();
    }
  }

  ngOnDestroy() {
    this.navSub?.unsubscribe();
    this.notifService.stopPolling();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.isBrowser) return;
    const target = event.target as HTMLElement;
    if (!target.closest('.header-right')) {
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
    this.showDropdown = !this.showDropdown;
    this.showNotifications = false;
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
    this.showDropdown = false;
  }

  closeNotificationsForNav() {
    this.showNotifications = false;
  }

  /** Buffer signup name + login id before RouterLink navigates to Team registration. */
  onNotifSignupPrefill(n: Notification) {
    if (n.kind === 'new_signup') {
      this.teamSignupPrefill.armFromNewSignup(n.brand, n.id);
    }
  }

  logout() {
    this.showDropdown = false;
    this.showLogoutPopup = true;
    setTimeout(() => {
      this.employeeProfile.reset();
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
  get isRepairAuthority(): boolean { return this.auth.isRepairAuthority(); }

  /** Route when user clicks an admin notification row */
  notifLink(n: Notification): (string | number)[] {
    if (n.kind === 'new_signup') {
      return ['/users'];
    }
    if (n.kind === 'assignment_request') {
      return ['/assignment-requests'];
    }
    const st = String(n.repair_status || '').trim();
    if (n.kind === 'repair' && st === 'ReviewPending') {
      return ['/repair-review', n.id];
    }
    return ['/repairs'];
  }

  /** Logo click target — arrays satisfy `RouterLink` typing; linked employees “home” is profile. */
  brandLink(): (string | number)[] {
    if (this.isAdmin) {
      return ['/dashboard'];
    }
    if (
      this.isLoggedIn &&
      !this.isRepairAuthority &&
      this.employeeProfile.hasLinkedProfile() === true
    ) {
      return ['/my-profile'];
    }
    return ['/'];
  }

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