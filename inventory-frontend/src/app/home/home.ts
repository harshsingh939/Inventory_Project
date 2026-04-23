import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrls: ['./home.css', './home-floating.scss'],
})
export class Home implements OnInit, OnDestroy {
  /** Cycling typewriter line on the hero (right panel) */
  readonly typedText = signal('');

  private intervalId?: ReturnType<typeof setInterval>;
  private phraseIndex = 0;
  private charIndex = 0;
  private phase: 'typing' | 'holding' | 'deleting' = 'typing';
  private holdTicks = 0;

  private readonly phrases: readonly string[] = [
    'Real-time asset tracking',
    'Smart repair workflows',
    'Sessions & assignments',
    'Role-based inventory access',
    'Named inventories & categories',
    'Repairs from request to fixed',
    'Dashboards that stay current',
    'Secure access for your team',
  ];

  ngOnInit(): void {
    try {
      if (
        typeof globalThis !== 'undefined' &&
        'matchMedia' in globalThis &&
        globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        this.typedText.set(this.phrases[0]);
        return;
      }
    } catch {
      /* ignore */
    }
    this.intervalId = setInterval(() => this.tick(), 42);
  }

  ngOnDestroy(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
    }
  }

  private tick(): void {
    const phrase = this.phrases[this.phraseIndex];
    if (this.phase === 'typing') {
      if (this.charIndex < phrase.length) {
        this.charIndex++;
        this.typedText.set(phrase.slice(0, this.charIndex));
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
      this.typedText.set(phrase.slice(0, this.charIndex));
    } else {
      this.phraseIndex = (this.phraseIndex + 1) % this.phrases.length;
      this.phase = 'typing';
    }
  }
}
