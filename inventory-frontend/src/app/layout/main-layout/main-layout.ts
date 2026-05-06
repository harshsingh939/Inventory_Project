import { Component, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';

import { Header } from '../header/header';
import { RagChatWidget } from '../../rag-chat-widget/rag-chat-widget';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, Header, RouterOutlet, RouterLink, RagChatWidget],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout implements OnDestroy {
  private readonly router = inject(Router);
  private readonly navSub: Subscription;

  /** Hide “back to home” on `/` (home) */
  readonly showBackHome = signal(false);

  constructor() {
    const sync = () => {
      const path = this.router.url.split('?')[0] || '/';
      this.showBackHome.set(path !== '/');
    };
    sync();
    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => sync());
  }

  ngOnDestroy(): void {
    this.navSub.unsubscribe();
  }

  /** Breadcrumb text for current route (e.g. Repairs, Assets › Cameras) */
  pageContextLabel(): string {
    const raw = this.router.url.split('?')[0] || '';
    const path = raw.replace(/^\/+|\/+$/g, '');
    if (!path) return '';
    const segments = path.split('/').filter(Boolean);
    const first = segments[0];
    const known: Record<string, string> = {
      dashboard: 'Dashboard',
      users: 'Users',
      repairs: 'Repairs',
      'repair-authority': 'Vendor repairs',
      'repair-costs': 'Repair cost history',
      sessions: 'Sessions',
      assets: 'Assets',
      'assignment-requests': 'Assignment requests',
      disposed: 'Disposed items',
      'rag-admin': 'Search index',
    };
    const titleCase = (s: string) =>
      s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    if (first === 'assets' && segments[1] === 'inv' && segments[2]) {
      return 'Assets › Inventory';
    }
    if (first === 'assets' && segments[1]) {
      return `Assets › ${titleCase(segments[1])}`;
    }
    if (known[first]) return known[first];
    return titleCase(first);
  }

}

