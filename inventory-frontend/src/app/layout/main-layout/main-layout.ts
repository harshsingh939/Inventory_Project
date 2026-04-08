import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Header } from '../header/header';
import { SidebarService } from '../sidebar/sidebar.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, Sidebar, Header, RouterOutlet],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css'
})
export class MainLayout {
  constructor(public sidebarService: SidebarService) {}

  get isSidebarOpen(): boolean {
    return this.sidebarService.isOpen();
  }
}