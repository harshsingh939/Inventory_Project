import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  assetBelongsToSlug,
  definitionForSlug,
} from '../assets/asset-category.config';
import { apiUrl } from '../api-url';

/** Row from GET /sessions/active */
export interface ActiveAssignmentRow {
  assignment_id: number;
  start_time?: string;
  condition_before?: string;
  status?: string;
  user_id?: string | number;
  asset_id?: number;
  user_name?: string;
  employee_id?: string;
  department?: string;
  asset_type?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
}

@Component({
  selector: 'app-asset-assignments-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './asset-assignments-panel.html',
  styleUrls: ['../sessions/sessions.css', './asset-assignments-panel.css'],
})
export class AssetAssignmentsPanel implements OnInit, OnChanges {
  private readonly apiBase = apiUrl('');

  /** Hub route slug, e.g. `systems`, `cables` */
  @Input({ required: true }) categorySlug!: string;
  /**
   * When set, only assignments and available rows whose `asset_id` is in this list
   * (parent derives from loaded assets for category + selected inventory).
   */
  @Input() assignmentScopeAssetIds: number[] | null = null;
  /** Shown in help text when filtering by a named inventory */
  @Input() scopeLabel: string | null = null;
  /** From Assign requests deep link — sent with checkout to update the ticket */
  @Input() assignmentRequestId: number | null = null;
  /** auth_users.id — pre-select employee whose Users row is linked to this login */
  @Input() prefillAuthUserId: number | null = null;

  users: any[] = [];
  rawAvailableAssets: any[] = [];
  availableAssets: any[] = [];

  rawActiveAssignments: ActiveAssignmentRow[] = [];
  activeAssignments: ActiveAssignmentRow[] = [];

  rawAllAssignments: any[] = [];
  allAssignments: any[] = [];

  selectedUserId = '';
  selectedAssetId = '';
  conditionBefore = 'Good';

  isLoading = false;
  isAssigning = false;
  errorMsg = '';
  successMsg = '';
  assetLoadError = '';
  assetLoadHint = '';
  activeTab: 'active' | 'history' = 'active';

  disposeModalAssignment: ActiveAssignmentRow | null = null;
  disposeNotes = '';
  disposing = false;

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadAll();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['categorySlug'] && !changes['categorySlug'].firstChange) {
      this.loadAll();
      return;
    }
    if (changes['prefillAuthUserId'] || changes['assignmentRequestId']) {
      this.applyPrefillFromInputs();
    }
    if (changes['assignmentScopeAssetIds'] || changes['scopeLabel']) {
      if (
        this.rawAvailableAssets.length > 0 ||
        this.rawActiveAssignments.length > 0 ||
        this.rawAllAssignments.length > 0
      ) {
        this.applyScopeFilters();
        this.cdr.detectChanges();
      }
    }
  }

  private scopeSet(): Set<number> | null {
    if (this.assignmentScopeAssetIds == null) {
      return null;
    }
    return new Set(this.assignmentScopeAssetIds.map((n) => Number(n)));
  }

  private applyPrefillFromInputs() {
    const authId = this.prefillAuthUserId;
    if (authId == null || !Number.isFinite(Number(authId))) {
      return;
    }
    const u = (this.users || []).find((x) => Number(x.auth_user_id) === Number(authId));
    if (u) {
      this.selectedUserId = String(u.id);
      this.cdr.detectChanges();
    }
  }

  private inCategory(assetType: string | undefined): boolean {
    return assetBelongsToSlug(String(assetType ?? ''), this.categorySlug);
  }

  private inAssetScope(assetId: number | string | undefined): boolean {
    const set = this.scopeSet();
    if (set == null) {
      return true;
    }
    const id = Number(assetId);
    return Number.isFinite(id) && set.has(id);
  }

  private applyScopeFilters() {
    const raw = this.rawAvailableAssets;
    const byCat = raw.filter((a) => this.inCategory(a.asset_type));
    let next = byCat;
    const set = this.scopeSet();
    if (set != null) {
      next = byCat.filter((a) => set.has(Number(a.id)));
    }
    this.availableAssets = next;
    if (
      byCat.length > 0 &&
      next.length === 0 &&
      set != null &&
      set.size > 0
    ) {
      this.assetLoadHint =
        'No free assets in this list match the inventory filter. Clear the inventory filter or add items to this list.';
    } else if (byCat.length === 0 && raw.length > 0) {
      this.assetLoadHint =
        'No available assets in this category right now. Other categories may still have stock.';
    } else {
      this.assetLoadHint = '';
    }

    this.activeAssignments = this.rawActiveAssignments.filter(
      (row) =>
        this.inCategory(row.asset_type) && this.inAssetScope(row.asset_id),
    );
    this.allAssignments = this.rawAllAssignments.filter(
      (row) =>
        this.inCategory(row.asset_type) && this.inAssetScope(row.asset_id),
    );
  }

  loadAll() {
    this.isLoading = true;
    this.assetLoadError = '';

    this.http.get<any[]>(`${this.apiBase}/users`).subscribe({
      next: (data) => {
        this.users = data;
        this.applyPrefillFromInputs();
        this.cdr.detectChanges();
      },
    });

    this.http.get<any[]>(`${this.apiBase}/assets/available`).subscribe({
      next: (data) => {
        this.rawAvailableAssets = Array.isArray(data) ? data : [];
        this.applyScopeFilters();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.assetLoadError =
          err.error?.message ||
          (typeof err.error === 'string' ? err.error : null) ||
          'Could not load available assets.';
        this.rawAvailableAssets = [];
        this.applyScopeFilters();
        this.cdr.detectChanges();
      },
    });

    this.http.get<ActiveAssignmentRow[]>(`${this.apiBase}/sessions/active`).subscribe({
      next: (data) => {
        this.rawActiveAssignments = Array.isArray(data) ? data : [];
        this.applyScopeFilters();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });

    this.http.get<any[]>(`${this.apiBase}/sessions/all`).subscribe({
      next: (data) => {
        this.rawAllAssignments = data;
        this.applyScopeFilters();
        this.cdr.detectChanges();
      },
    });
  }

  categoryTitle(): string {
    return definitionForSlug(this.categorySlug)?.title ?? this.categorySlug;
  }

  assignAsset() {
    if (!this.selectedUserId) {
      this.errorMsg = 'Please select a user';
      return;
    }
    if (!this.selectedAssetId) {
      this.errorMsg = 'Please select an asset';
      return;
    }

    this.errorMsg = '';
    this.successMsg = '';
    this.isAssigning = true;

    const body: Record<string, unknown> = {
      user_id: this.selectedUserId,
      asset_id: this.selectedAssetId,
      condition_before: this.conditionBefore,
    };
    if (
      this.assignmentRequestId != null &&
      Number.isFinite(Number(this.assignmentRequestId))
    ) {
      body['assignment_request_id'] = Number(this.assignmentRequestId);
    }

    this.http
      .post<any>(`${this.apiBase}/sessions/start`, body)
      .subscribe({
        next: () => {
          this.isAssigning = false;
          this.successMsg = '✅ Asset assigned successfully!';
          this.selectedUserId = '';
          this.selectedAssetId = '';
          this.conditionBefore = 'Good';
          this.loadAll();
          this.cdr.detectChanges();
          setTimeout(() => {
            this.successMsg = '';
            this.cdr.detectChanges();
          }, 3000);
        },
        error: (err) => {
          this.isAssigning = false;
          this.errorMsg = err.error?.message || 'Failed to assign asset';
          this.cdr.detectChanges();
        },
      });
  }

  unassignAsset(assignmentId: number) {
    this.errorMsg = '';
    this.http
      .post<any>(`${this.apiBase}/sessions/end`, {
        assignment_id: assignmentId,
        condition_after: 'Good',
      })
      .subscribe({
        next: () => {
          this.successMsg = '✅ Asset returned to stock';
          this.loadAll();
          this.cdr.detectChanges();
          setTimeout(() => {
            this.successMsg = '';
            this.cdr.detectChanges();
          }, 3000);
        },
        error: (err) => {
          this.errorMsg = err.error?.message || 'Failed to unassign';
          this.cdr.detectChanges();
        },
      });
  }

  openDisposeModal(row: ActiveAssignmentRow) {
    this.errorMsg = '';
    this.disposeModalAssignment = row;
    this.disposeNotes = '';
    this.cdr.detectChanges();
  }

  closeDisposeModal() {
    if (this.disposing) {
      return;
    }
    this.disposeModalAssignment = null;
    this.disposeNotes = '';
    this.cdr.detectChanges();
  }

  confirmDispose() {
    const row = this.disposeModalAssignment;
    if (!row || this.disposing) {
      return;
    }
    const assignmentId = Number(row.assignment_id);
    if (!Number.isFinite(assignmentId)) {
      this.errorMsg = 'Invalid assignment';
      this.closeDisposeModal();
      return;
    }
    this.disposing = true;
    this.errorMsg = '';
    this.http
      .post<any>(`${this.apiBase}/disposals`, {
        assignment_id: assignmentId,
        condition_after: 'Not reusable / disposed',
        notes: this.disposeNotes.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.disposing = false;
          this.disposeModalAssignment = null;
          this.disposeNotes = '';
          this.successMsg = '✅ Item disposed and removed from inventory';
          this.loadAll();
          this.cdr.detectChanges();
          setTimeout(() => {
            this.successMsg = '';
            this.cdr.detectChanges();
          }, 3500);
        },
        error: (err) => {
          this.disposing = false;
          this.errorMsg = err.error?.message || 'Dispose failed';
          this.cdr.detectChanges();
        },
      });
  }

  formatSessionDuration(
    workingMinutes: number | string | null | undefined,
  ): string {
    const raw = Number(workingMinutes);
    if (!Number.isFinite(raw) || raw <= 0) {
      return '—';
    }
    const total = Math.floor(raw);
    const MIN_PER_DAY = 24 * 60;
    if (total < MIN_PER_DAY) {
      return `${total} mins`;
    }
    const days = Math.floor(total / MIN_PER_DAY);
    let rem = total % MIN_PER_DAY;
    const hours = Math.floor(rem / 60);
    rem %= 60;
    const mins = rem;
    const parts: string[] = [];
    parts.push(days === 1 ? '1 day' : `${days} days`);
    if (hours > 0) {
      parts.push(hours === 1 ? '1 hr' : `${hours} hrs`);
    }
    if (mins > 0) {
      parts.push(mins === 1 ? '1 min' : `${mins} mins`);
    }
    return parts.join(' ');
  }
}
