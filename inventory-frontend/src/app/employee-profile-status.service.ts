import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { apiUrl } from './api-url';

/**
 * Whether the logged-in employee has a linked `users` row (name + department).
 * Used to gate the public Home route/link until an admin completes Team registration.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeProfileStatusService {
  private readonly usersUrl = apiUrl('users');

  /** `null` = not checked yet; `true` / `false` after {@link refresh}. */
  readonly hasLinkedProfile = signal<boolean | null>(null);

  constructor(private readonly http: HttpClient) {}

  reset(): void {
    this.hasLinkedProfile.set(null);
  }

  /** GET /api/users (scoped); updates {@link hasLinkedProfile}. */
  refresh(): Observable<boolean> {
    return this.http.get<unknown[]>(this.usersUrl).pipe(
      catchError(() => of([])),
      map((list) => {
        const row = Array.isArray(list) ? (list[0] as Record<string, unknown> | undefined) : undefined;
        const name = String(row?.['name'] ?? '').trim();
        const dept = String(row?.['department'] ?? '').trim();
        return !!(name && dept);
      }),
      tap((has) => this.hasLinkedProfile.set(has)),
    );
  }
}
