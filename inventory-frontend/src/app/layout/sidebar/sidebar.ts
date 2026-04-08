import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarService } from './sidebar.service';
import { AuthService } from '../../auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class Sidebar {
  constructor(
    public sidebarService: SidebarService,
    private auth: AuthService
  ) {}

  get isOpen(): boolean {
    return this.sidebarService.isOpen();
  }

  get isAdmin(): boolean {
    return this.auth.isAdmin();
  }
}