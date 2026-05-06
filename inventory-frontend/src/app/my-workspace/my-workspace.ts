import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { apiUrl } from '../api-url';

@Component({
  selector: 'app-my-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './my-workspace.html',
  styleUrl: './my-workspace.css',
})
export class MyWorkspace implements OnInit {
  private readonly api = apiUrl('');

  /** GET /me/assignments */
  linked = false;
  hint = '';
  active: any[] = [];
  history: any[] = [];
  /** Only when /me/assignments fails (e.g. token) */
  meError = '';

  /** Fixed device categories on this screen (not driven by catalog) */
  readonly requestDeviceTypes: readonly string[] = ['Desktop', 'Laptop'];
  selectedAssetTypes = new Set<string>();

  requestMessage = '';
  submitting = false;
  loading = true;
  errorMsg = '';
  successMsg = '';
  myRequests: any[] = [];

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.refreshAll();
  }

  refreshAll() {
    this.loading = true;
    this.errorMsg = '';
    this.meError = '';

    forkJoin({
      me: this.http.get<any>(`${this.api}/me/assignments`).pipe(
        catchError((e) => of({ __error: e })),
      ),
      mine: this.http.get<any[]>(`${this.api}/assignment-requests/mine`).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ me, mine }) => {
        if (me && (me as { __error?: unknown }).__error) {
          const err = (me as { __error: { error?: { message?: string } } }).__error;
          this.meError =
            err.error?.message ||
            (typeof err.error === 'string' ? err.error : null) ||
            'Could not load assignments';
          this.linked = false;
          this.hint = '';
          this.active = [];
          this.history = [];
        } else {
          this.meError = '';
          const data = me as Record<string, unknown>;
          this.linked = !!data?.['linked'];
          this.hint = (data?.['hint'] as string) || '';
          this.active = (data?.['active'] as unknown[]) || [];
          this.history = (data?.['history'] as unknown[]) || [];
        }

        this.myRequests = Array.isArray(mine) ? mine : [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.errorMsg = 'Could not load workspace data';
        this.cdr.detectChanges();
      },
    });
  }

  toggleAssetType(t: string) {
    const key = String(t).trim();
    if (!key) return;
    if (this.selectedAssetTypes.has(key)) {
      this.selectedAssetTypes.delete(key);
    } else {
      this.selectedAssetTypes.add(key);
    }
    this.selectedAssetTypes = new Set(this.selectedAssetTypes);
    this.cdr.detectChanges();
  }

  isTypeSelected(t: string): boolean {
    return this.selectedAssetTypes.has(String(t).trim());
  }

  submitRequest() {
    if (!this.linked) {
      this.errorMsg = 'Save your profile under Users (sidebar) first: name, Employee ID, department.';
      this.cdr.detectChanges();
      return;
    }
    const allowedTypes = new Set(this.requestDeviceTypes);
    const asset_types = [...this.selectedAssetTypes].filter((t) => allowedTypes.has(String(t).trim()));
    if (asset_types.length === 0) {
      this.errorMsg = 'Select Desktop and/or Laptop';
      this.cdr.detectChanges();
      return;
    }
    this.submitting = true;
    this.errorMsg = '';
    this.successMsg = '';
    const body: { asset_types: string[]; user_message?: string } = {
      asset_types,
      user_message: this.requestMessage.trim() || undefined,
    };

    this.http.post<any>(`${this.api}/assignment-requests`, body).subscribe({
      next: () => {
        this.submitting = false;
        this.selectedAssetTypes.clear();
        this.requestMessage = '';
        this.successMsg = 'Request sent. Admin will assign one available unit per selection.';
        this.refreshAll();
        this.cdr.detectChanges();
        setTimeout(() => {
          this.successMsg = '';
          this.cdr.detectChanges();
        }, 4000);
      },
      error: (err) => {
        this.submitting = false;
        this.errorMsg = err.error?.message || 'Request failed';
        this.cdr.detectChanges();
      },
    });
  }
}
