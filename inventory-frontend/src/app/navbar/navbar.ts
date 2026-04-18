import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-navbar',
  standalone:true,
  imports: [FormsModule,CommonModule,RouterModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  // my add
  isMenuOpen = false;
  isAdmin = false;
    constructor(public auth: AuthService) {}


  ngOnInit() {
    this.checkRole();
  }

  checkRole() {
    this.isAdmin = this.auth.isAdmin();
    console.log("ROLE:", this.auth.getRole()); // debug
  }
    toggleMenu(){
    this.isMenuOpen = !this.isMenuOpen;
  }
}
