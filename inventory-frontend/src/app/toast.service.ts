import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly platformId = inject(PLATFORM_ID);
  private seq = 0;
  readonly items = signal<ToastItem[]>([]);

  show(message: string, opts?: { type?: ToastType; durationMs?: number }) {
    if (!isPlatformBrowser(this.platformId)) return;
    const type = opts?.type ?? 'info';
    const durationMs = opts?.durationMs ?? 4200;
    const id = ++this.seq;
    this.items.update((list) => [...list, { id, message, type }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  success(message: string) {
    this.show(message, { type: 'success' });
  }

  error(message: string) {
    this.show(message, { type: 'error', durationMs: 6500 });
  }

  dismiss(id: number) {
    this.items.update((list) => list.filter((t) => t.id !== id));
  }
}
