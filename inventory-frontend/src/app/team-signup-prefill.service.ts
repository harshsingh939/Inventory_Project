import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

export interface TeamSignupDraft {
  name: string;
  authUserId: number;
}

/**
 * When an admin clicks a "New account" notification, we buffer name + login id
 * and navigate to Team registration; {@link Users} consumes it into the add form.
 */
@Injectable({ providedIn: 'root' })
export class TeamSignupPrefillService {
  private draft: TeamSignupDraft | null = null;
  /** When true, name + login id inputs from signup stay disabled until unlock or abandon. */
  readonly nameLocked = signal(false);
  private readonly applyTrigger = new Subject<void>();
  readonly apply$ = this.applyTrigger.asObservable();

  /** Call from header before navigating to `/users` for a new signup notification. */
  armFromNewSignup(name: string | null | undefined, authUserId: number | string | null | undefined) {
    const idNum = typeof authUserId === 'number' ? authUserId : Number(authUserId);
    if (!Number.isFinite(idNum)) return;
    const t = (name ?? '').trim();
    if (!t) return;
    this.draft = { name: t, authUserId: Math.trunc(idNum) };
    this.nameLocked.set(true);
    this.applyTrigger.next();
  }

  /** Returns buffered payload once and clears the buffer (lock stays until unlock). */
  takeDraft(): TeamSignupDraft | null {
    const v = this.draft;
    this.draft = null;
    return v;
  }

  unlockNameField() {
    this.nameLocked.set(false);
  }

  /** Leaving Team registration drops any half-filled signup prefill state. */
  abandonOnLeaveUsersPage() {
    this.draft = null;
    this.nameLocked.set(false);
  }
}
