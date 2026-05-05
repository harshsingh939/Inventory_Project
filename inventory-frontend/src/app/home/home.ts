import { Component, OnDestroy, OnInit, signal, type WritableSignal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';
import { apiUrl } from '../api-url';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrls: ['./home.css', './home-floating.scss', './vendor-home.css'],
})
export class Home implements OnInit, OnDestroy {
  /** Public home — typewriter (right panel of hero) */
  readonly typedText = signal('');

  /** Vendor home — typewriter (repair lane aside) */
  readonly vendorTypedText = signal('');

  /** repair_authority: jobs currently in Under repair (vendor queue) for this login */
  readonly vendorQueueCount = signal<number | null>(null);
  readonly vendorQueueLoading = signal(false);

  private intervalId?: ReturnType<typeof setInterval>;
  private phraseIndex = 0;
  private charIndex = 0;
  private phase: 'typing' | 'holding' | 'deleting' = 'typing';
  private holdTicks = 0;

  constructor(
    private readonly router: Router,
    private readonly auth: AuthService,
    private readonly http: HttpClient,
  ) {}

  /** Logged-in repair vendor — dedicated home layout */
  get isVendorHome(): boolean {
    return this.auth.isLoggedIn() && this.auth.isRepairAuthority();
  }

  private readonly publicPhrases: readonly string[] = [
    'Real-time asset tracking',
    'Smart repair workflows',
    'Per-category assignments',
    'Role-based inventory access',
    'Category inventories from your database',
    'Repairs from request to fixed',
    'Dashboards that stay current',
    'Secure access for your team',
  ];

  private readonly vendorPhrases: readonly string[] = [
    'Trust is the quiet engine behind every good fix.',
    'Hardware rests; relationships should not.',
    'Assign with clarity—return with craft.',
    'We grow when your work speaks louder than the pitch.',
    'A steady hand on software, a steady word on hardware.',
    'Partnership: two names, one promise to the user.',
    'Small repairs water the roots of big loyalty.',
    'What is fixed with care outlasts what is sold in haste.',
  ];

  ngOnInit(): void {
    if (this.auth.isLoggedIn() && this.auth.isAdmin()) {
      void this.router.navigate(['/dashboard'], { replaceUrl: true });
      return;
    }
    if (this.auth.isLoggedIn() && this.auth.isRepairAuthority()) {
      this.loadVendorQueueCount();
      this.startTypewriter(this.vendorPhrases, this.vendorTypedText);
      return;
    }
    this.startTypewriter(this.publicPhrases, this.typedText);
  }

  /** Starts cycling typewriter into `out`; respects reduced motion. */
  private startTypewriter(phrases: readonly string[], out: WritableSignal<string>): void {
    try {
      if (
        typeof globalThis !== 'undefined' &&
        'matchMedia' in globalThis &&
        globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        out.set(phrases[0]);
        return;
      }
    } catch {
      /* ignore */
    }
    this.phraseIndex = 0;
    this.charIndex = 0;
    this.phase = 'typing';
    this.holdTicks = 0;
    this.intervalId = setInterval(() => this.tick(phrases, out), 42);
  }

  ngOnDestroy(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
    }
  }

  private loadVendorQueueCount(): void {
    this.vendorQueueLoading.set(true);
    this.http.get<unknown[]>(apiUrl('repairs/authority-queue')).subscribe({
      next: (rows) => {
        this.vendorQueueCount.set(Array.isArray(rows) ? rows.length : 0);
        this.vendorQueueLoading.set(false);
      },
      error: () => {
        this.vendorQueueCount.set(null);
        this.vendorQueueLoading.set(false);
      },
    });
  }

  private tick(phrases: readonly string[], out: WritableSignal<string>): void {
    const phrase = phrases[this.phraseIndex];
    if (this.phase === 'typing') {
      if (this.charIndex < phrase.length) {
        this.charIndex++;
        out.set(phrase.slice(0, this.charIndex));
      } else {
        this.phase = 'holding';
        this.holdTicks = 0;
      }
      return;
    }
    if (this.phase === 'holding') {
      this.holdTicks++;
      if (this.holdTicks >= 40) {
        this.phase = 'deleting';
      }
      return;
    }
    /* deleting */
    if (this.charIndex > 0) {
      this.charIndex--;
      out.set(phrase.slice(0, this.charIndex));
    } else {
      this.phraseIndex = (this.phraseIndex + 1) % phrases.length;
      this.phase = 'typing';
    }
  }
}
