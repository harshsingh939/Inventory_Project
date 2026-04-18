import { Component, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
  isDropdown = false;
  isDropdownOpen = false;
  showLogoutPopup = false;
  showDropdown = false;
  isNavDropdownOpen=false;
 
  
  isBrowser: boolean;
notifications: any[] = [];   // ✅ OUTSIDE
  constructor(
    public auth: AuthService,
    private router: Router,
   
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }
 // my add




  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.isBrowser) return;   // ✅ SSR safe
    const target = event.target as HTMLElement;
    if (!target.closest('.header-right')) {
      this.showDropdown = false;
    }    
  //  my add

  if (!target.closest('.notification-dropdown') && !target.closest('.icon-btn')) {

}
      // ✅  my ADD
  if (!target.closest('.nav-dropdown-wrapper')) {
    this.isNavDropdownOpen = false;
  }
  }
// my add
  toggleNavDropdown(){
    this.isNavDropdownOpen = !this.isNavDropdownOpen;
  }
  closeNavDropdown() {
  this.isNavDropdownOpen = false;
}
// my add end
  

  toggleDropdown() {
    this.showDropdown = !this.showDropdown;
  }
  closeDropdown(){
    this.isDropdownOpen=false;
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
