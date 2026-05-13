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
  /** Only when /me/assignments fails (e.g. token) */
  meError = '';

  /** Fixed device categories on this screen (not driven by catalog). "Other" is exclusive — note describes the item. */
  readonly requestDeviceTypes: readonly string[] = ['Desktop', 'Laptop', 'Other'];
  selectedAssetTypes = new Set<string>();

  private static readonly OTHER = 'Other';

  get isOtherSelected(): boolean {
    return this.selectedAssetTypes.has(MyWorkspace.OTHER);
  }

  requestMessage = '';
  submitting = false;
  loading = true;
  errorMsg = '';
  successMsg = '';
  myRequests: any[] = [];

  get openRequestCount(): number {
    return this.myRequests.filter((q) => String(q?.status || '').toLowerCase() === 'pending').length;
  }

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
        } else {
          this.meError = '';
          const data = me as Record<string, unknown>;
          this.linked = !!data?.['linked'];
          this.hint = (data?.['hint'] as string) || '';
          this.active = (data?.['active'] as unknown[]) || [];
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
    if (key === MyWorkspace.OTHER) {
      if (this.selectedAssetTypes.has(MyWorkspace.OTHER)) {
        this.selectedAssetTypes.delete(MyWorkspace.OTHER);
      } else {
        this.selectedAssetTypes = new Set([MyWorkspace.OTHER]);
      }
    } else {
      const next = new Set(this.selectedAssetTypes);
      next.delete(MyWorkspace.OTHER);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      this.selectedAssetTypes = next;
    }
    this.selectedAssetTypes = new Set(this.selectedAssetTypes);
    this.cdr.detectChanges();
  }

  isTypeSelected(t: string): boolean {
    return this.selectedAssetTypes.has(String(t).trim());
  }

  submitRequest() {
    if (!this.linked) {
      this.errorMsg =
        'Your employee profile is not linked yet. Ask an administrator to add you in Team registration, then check My profile.';
      this.cdr.detectChanges();
      return;
    }
    const allowedTypes = new Set(this.requestDeviceTypes);
    const asset_types = [...this.selectedAssetTypes].filter((t) => allowedTypes.has(String(t).trim()));
    if (asset_types.length === 0) {
      this.errorMsg = 'Select Desktop, Laptop, or Other';
      this.cdr.detectChanges();
      return;
    }
    const note = this.requestMessage.trim();
    if (asset_types.includes(MyWorkspace.OTHER)) {
      if (note.length < 2) {
        this.errorMsg =
          'For “Other”, describe what you need in the note (e.g. mouse, HDMI cable, keyboard).';
        this.cdr.detectChanges();
        return;
      }
    }
    this.submitting = true;
    this.errorMsg = '';
    this.successMsg = '';
    const body: { asset_types: string[]; user_message?: string } = {
      asset_types,
      user_message: note || undefined,
    };

    this.http.post<any>(`${this.api}/assignment-requests`, body).subscribe({
      next: () => {
        this.submitting = false;
        this.selectedAssetTypes.clear();
        this.requestMessage = '';
        this.successMsg = asset_types.includes(MyWorkspace.OTHER)
          ? 'Request sent. List multiple accessories separated by commas or new lines — auto-assign matches each line to stock when possible.'
          : 'Request sent. Admin will assign one available unit per selection.';
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
