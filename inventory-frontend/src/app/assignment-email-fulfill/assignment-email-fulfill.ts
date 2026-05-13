import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { take } from 'rxjs/operators';
import { apiUrl } from '../api-url';

/**
 * Public page (no auth): email “Approve & auto-assign” opens this URL and
 * immediately POSTs /api/assignment-requests/email-fulfill — avoids AdminGuard on /assignment-requests.
 */
@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="shell">
      <div class="card">
        <p class="brand">InvenTrack</p>
        <ng-container [ngSwitch]="phase">
          <ng-container *ngSwitchCase="'loading'">
            <h1>Completing assignment</h1>
            <p class="muted">Please wait…</p>
          </ng-container>
          <ng-container *ngSwitchCase="'ok'">
            <h1 class="ok-h">Done</h1>
            <p>{{ message }}</p>
            <a routerLink="/login" [queryParams]="loginQuery" class="link">Sign in to open the app</a>
          </ng-container>
          <ng-container *ngSwitchCase="'err'">
            <h1 class="err-h">Could not complete</h1>
            <p>{{ message }}</p>
            <a routerLink="/login" [queryParams]="loginQuery" class="link">Sign in</a>
          </ng-container>
        </ng-container>
      </div>
    </div>
  `,
  styles: [
    `
      .shell {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(180deg, #020617 0%, #0f172a 100%);
        padding: 24px;
        font-family: system-ui, Segoe UI, Roboto, sans-serif;
      }
      .card {
        max-width: 420px;
        width: 100%;
        padding: 28px;
        border-radius: 16px;
        border: 1px solid rgba(56, 189, 248, 0.25);
        background: rgba(15, 23, 42, 0.96);
        color: #e2e8f0;
      }
      .brand {
        margin: 0 0 16px;
        font-size: 11px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #7dd3fc;
        font-weight: 600;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 1.35rem;
        font-weight: 700;
      }
      .ok-h {
        color: #34d399;
      }
      .err-h {
        color: #f87171;
      }
      .muted {
        color: #94a3b8;
        margin: 0;
      }
      p {
        margin: 0 0 16px;
        line-height: 1.5;
        color: #cbd5e1;
      }
      .link {
        display: inline-block;
        margin-top: 8px;
        color: #38bdf8;
        text-decoration: none;
        font-weight: 600;
      }
      .link:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class AssignmentEmailFulfill implements OnInit {
  phase: 'loading' | 'ok' | 'err' = 'loading';
  message = '';
  loginQuery: Record<string, string> = {};
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    let token =
      this.route.snapshot.queryParamMap.get('emailFulfill') ||
      this.route.snapshot.queryParamMap.get('t') ||
      '';
    token = token.replace(/\s+/g, '').trim();
    const rid = this.route.snapshot.queryParamMap.get('requestId');
    if (rid && /^\d+$/.test(rid)) {
      this.loginQuery = { returnUrl: `/assignment-requests?requestId=${rid}` };
    }

    if (!token || token.length < 32) {
      this.phase = 'err';
      this.message =
        'Invalid or missing link. Use a newer admin email, or sign in and click Assigned on the queue.';
      this.cdr.detectChanges();
      return;
    }

    const url = `${apiUrl('assignment-requests')}/email-fulfill`;
    this.http
      .post<{ message?: string }>(url, { token })
      .pipe(take(1))
      .subscribe({
        next: (res) => {
          this.phase = 'ok';
          this.message = res?.message || 'Assets assigned.';
          this.cdr.detectChanges();
        },
        error: (err: unknown) => {
          const he = err as HttpErrorResponse;
          const body = he.error;
          let msg = '';
          if (body && typeof body === 'object' && 'message' in body) {
            msg = String((body as { message?: string }).message || he.message);
          } else if (typeof body === 'string' && body.trim()) {
            msg = body.trim();
          } else {
            msg = he.message || 'Something went wrong.';
          }
          // Older API: second open of the same link returned 400 "not pending" after first success.
          if (he.status === 400 && /not pending/i.test(msg)) {
            this.phase = 'ok';
            this.message =
              'This request was already completed. The link had already been used — nothing more to do.';
            this.cdr.detectChanges();
            return;
          }
          this.phase = 'err';
          this.message = msg;
          this.cdr.detectChanges();
        },
      });
  }
}
