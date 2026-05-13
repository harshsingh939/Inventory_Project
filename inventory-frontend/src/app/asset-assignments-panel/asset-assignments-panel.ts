import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
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

/** One row per asset for the history asset picker (deduped from assignment rows). */
export interface HistoryAssetPickRow {
  asset_id: number;
  asset_type?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
}

/** Disposal snapshot from GET /api/assets/:id/history */
export interface AssetHistoryDisposedSnapshot {
  disposed_at?: string | Date | null;
  notes?: string | null;
  condition_after?: string | null;
}

/** One repair row from GET /api/assets/:id/history */
export interface AssetHistoryRepairRow {
  status?: string | null;
  issue?: string | null;
  occurred_at?: string | Date | null;
}

/** Response from GET /api/assets/:id/history */
export interface AssetHistoryResponse {
  asset_id: number;
  asset: Record<string, unknown> | null;
  disposed: AssetHistoryDisposedSnapshot | null;
  assignments: any[];
  repairs: AssetHistoryRepairRow[];
  events: any[];
}

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
  /** Parent can hide inventory / add-asset UI while History tab is open */
  @Output() historyTabActive = new EventEmitter<boolean>();
  /** After assign / unassign / dispose — parent should refetch GET /api/assets so status badges stay in sync */
  @Output() inventoryAssetsChanged = new EventEmitter<void>();

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

  /** History tab: search employees vs search assets (same UX in every category/inventory). */
  historyKind: 'employee' | 'asset' = 'employee';
  /** Filters the roster for history employee picker */
  historyPickerQuery = '';
  /** When set, history table shows rawAllAssignments rows for this user only (full org, any category). */
  historySelectedUserId: number | null = null;
  /** Search serial / model / brand / type for asset history picker */
  historyAssetPickerQuery = '';
  /** When set, modal lists every checkout of this asset (full org). */
  historySelectedAssetId: number | null = null;

  /** Loaded from GET /api/assets/:id/history when viewing By asset (includes post-dispose assignment rows). */
  assetHistoryDetail: AssetHistoryResponse | null = null;
  assetHistoryLoading = false;
  assetHistoryError = '';

  /** Narrowed disposal row for strict template typing. */
  get historyDisposedView(): AssetHistoryDisposedSnapshot | null {
    return this.assetHistoryDetail?.disposed ?? null;
  }

  /** Repairs list for *ngFor (never null). */
  get historyRepairsView(): AssetHistoryRepairRow[] {
    return this.assetHistoryDetail?.repairs ?? [];
  }

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.historyTabActive.emit(false);
    this.loadAll();
  }

  setAssignmentsTab(tab: 'active' | 'history'): void {
    this.activeTab = tab;
    this.historyTabActive.emit(tab === 'history');
  }

  setHistoryKind(kind: 'employee' | 'asset'): void {
    if (this.historyKind === kind) {
      return;
    }
    this.historyKind = kind;
    this.historySelectedUserId = null;
    this.historySelectedAssetId = null;
    this.historyPickerQuery = '';
    this.historyAssetPickerQuery = '';
    this.resetAssetHistoryFetch();
    this.cdr.detectChanges();
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

  /** Employees from /users matching the picker query (for explicit selection before showing history). */
  historyEmployeesMatching(): any[] {
    const q = String(this.historyPickerQuery || '').trim().toLowerCase();
    if (!q || !(this.users || []).length) {
      return [];
    }
    const list = this.users.filter((u) => {
      const name = String(u.name ?? '').toLowerCase();
      const emp = String(u.employee_id ?? '').toLowerCase();
      return name.includes(q) || emp.includes(q);
    });
    return list.slice(0, 40);
  }

  selectEmployeeForHistory(u: any): void {
    const id = Number(u?.id);
    if (!Number.isFinite(id)) {
      return;
    }
    this.historyKind = 'employee';
    this.historySelectedAssetId = null;
    this.historyAssetPickerQuery = '';
    this.resetAssetHistoryFetch();
    this.historySelectedUserId = id;
    this.cdr.detectChanges();
  }

  selectAssetForHistory(row: HistoryAssetPickRow): void {
    const id = Number(row?.asset_id);
    if (!Number.isFinite(id)) {
      return;
    }
    this.historyKind = 'asset';
    this.historySelectedUserId = null;
    this.historyPickerQuery = '';
    this.historySelectedAssetId = id;
    this.fetchAssetHistory(id);
    this.cdr.detectChanges();
  }

  /** Close modal / clear picker for the active history kind. */
  clearHistorySelection(): void {
    this.historySelectedUserId = null;
    this.historySelectedAssetId = null;
    this.historyPickerQuery = '';
    this.historyAssetPickerQuery = '';
    this.resetAssetHistoryFetch();
    this.cdr.detectChanges();
  }

  private resetAssetHistoryFetch(): void {
    this.assetHistoryDetail = null;
    this.assetHistoryLoading = false;
    this.assetHistoryError = '';
  }

  private fetchAssetHistory(assetId: number): void {
    this.assetHistoryLoading = true;
    this.assetHistoryError = '';
    this.assetHistoryDetail = null;
    this.http
      .get<AssetHistoryResponse>(`${this.apiBase}/assets/${assetId}/history`)
      .subscribe({
        next: (data) => {
          if (Number(this.historySelectedAssetId) !== assetId) {
            return;
          }
          this.assetHistoryDetail = data;
          this.assetHistoryLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          if (Number(this.historySelectedAssetId) !== assetId) {
            return;
          }
          this.assetHistoryLoading = false;
          this.assetHistoryDetail = null;
          this.assetHistoryError =
            err.error?.message ||
            (typeof err.error === 'string' ? err.error : null) ||
            'Could not load asset history.';
          this.cdr.detectChanges();
        },
      });
  }

  clearHistoryEmployeeSelection(): void {
    this.clearHistorySelection();
  }

  get historyRowsForView(): any[] {
    const uid = this.historySelectedUserId;
    if (uid == null || !Number.isFinite(Number(uid))) {
      return [];
    }
    const rows = this.rawAllAssignments.filter(
      (row) => Number(row.user_id) === Number(uid),
    );
    return rows.slice().sort((a, b) => {
      const ta = new Date(a.start_time ?? 0).getTime();
      const tb = new Date(b.start_time ?? 0).getTime();
      return tb - ta;
    });
  }

  get historyRowsForAssetView(): any[] {
    const aid = this.historySelectedAssetId;
    if (aid == null || !Number.isFinite(Number(aid))) {
      return [];
    }
    const rows = this.rawAllAssignments.filter(
      (row) => Number(row.asset_id) === Number(aid),
    );
    return rows.slice().sort((a, b) => {
      const ta = new Date(a.start_time ?? 0).getTime();
      const tb = new Date(b.start_time ?? 0).getTime();
      return tb - ta;
    });
  }

  private sortHistoryAssignmentRows(rows: any[]): any[] {
    return rows.slice().sort((a, b) => {
      const ta = new Date(a.start_time ?? 0).getTime();
      const tb = new Date(b.start_time ?? 0).getTime();
      return tb - ta;
    });
  }

  /** Rows shown in the history modal (employee or asset mode). */
  get historyModalRows(): any[] {
    if (this.historySelectedAssetId != null) {
      if (this.assetHistoryDetail && !this.assetHistoryLoading) {
        return this.sortHistoryAssignmentRows(
          this.assetHistoryDetail.assignments || [],
        );
      }
      return this.historyRowsForAssetView;
    }
    if (this.historySelectedUserId != null) {
      return this.historyRowsForView;
    }
    return [];
  }

  /** Deduped assets that appear anywhere in assignment history (org-wide). */
  distinctHistoryAssets(): HistoryAssetPickRow[] {
    const map = new Map<number, HistoryAssetPickRow>();
    for (const row of this.rawAllAssignments || []) {
      const aid = Number(row.asset_id);
      if (!Number.isFinite(aid)) {
        continue;
      }
      if (!map.has(aid)) {
        map.set(aid, {
          asset_id: aid,
          asset_type: row.asset_type,
          brand: row.brand,
          model: row.model,
          serial_number: row.serial_number,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.asset_id - a.asset_id);
  }

  /** Assets matching history search (type, brand, model, serial, id). */
  historyAssetsMatching(): HistoryAssetPickRow[] {
    const q = String(this.historyAssetPickerQuery || '').trim().toLowerCase();
    if (!q) {
      return [];
    }
    return this.distinctHistoryAssets()
      .filter((row) => {
        const idStr = String(row.asset_id);
        const parts = [
          String(row.asset_type ?? '').toLowerCase(),
          String(row.brand ?? '').toLowerCase(),
          String(row.model ?? '').toLowerCase(),
          String(row.serial_number ?? '').toLowerCase(),
          idStr,
        ];
        return parts.some((p) => p.includes(q));
      })
      .slice(0, 40);
  }

  /** Tab label suffix, e.g. " (12)" once an employee is selected. */
  get historyTabCountLabel(): string {
    if (this.historySelectedUserId == null && this.historySelectedAssetId == null) {
      return '';
    }
    return ` (${this.historyModalRows.length})`;
  }

  get historySelectedUserName(): string {
    const id = this.historySelectedUserId;
    if (id == null) {
      return '';
    }
    const u = (this.users || []).find((x) => Number(x.id) === Number(id));
    if (u) {
      return `${u.name} (${u.employee_id})`;
    }
    const row = this.rawAllAssignments.find((r) => Number(r.user_id) === Number(id));
    if (row) {
      return `${row.user_name} (${row.employee_id})`;
    }
    return `User #${id}`;
  }

  get historySelectedAssetLabel(): string {
    const id = this.historySelectedAssetId;
    if (id == null) {
      return '';
    }
    const d = this.assetHistoryDetail;
    const fromAsset = d?.asset as
      | { asset_type?: string; brand?: string; model?: string; serial_number?: string }
      | null
      | undefined;
    if (fromAsset && (fromAsset.asset_type || fromAsset.brand || fromAsset.model)) {
      const type = String(fromAsset.asset_type ?? 'Asset');
      const brand = fromAsset.brand ? String(fromAsset.brand) : '';
      const model = fromAsset.model ? String(fromAsset.model) : '';
      const sn = fromAsset.serial_number ? ` · SN ${fromAsset.serial_number}` : '';
      const head = [type, brand, model].filter(Boolean).join(' — ');
      return `${head || `Asset #${id}`}${sn}`;
    }
    const disp = d?.disposed as
      | {
          asset_type?: string;
          brand?: string;
          model?: string;
          serial_number?: string;
        }
      | null
      | undefined;
    if (disp && (disp.asset_type || disp.brand || disp.model)) {
      const type = String(disp.asset_type ?? 'Asset');
      const brand = disp.brand ? String(disp.brand) : '';
      const model = disp.model ? String(disp.model) : '';
      const sn = disp.serial_number ? ` · SN ${disp.serial_number}` : '';
      const head = [type, brand, model].filter(Boolean).join(' — ');
      return `${head} (disposed)${sn}`;
    }
    const row = this.historyRowsForAssetView[0] ||
      this.rawAllAssignments.find((r) => Number(r.asset_id) === Number(id)) ||
      (d?.assignments && d.assignments[0]);
    if (row) {
      const type = row.asset_type ?? 'Asset';
      const brand = row.brand ? String(row.brand) : '';
      const model = row.model ? String(row.model) : '';
      const sn = row.serial_number ? ` · SN ${row.serial_number}` : '';
      const head = [type, brand, model].filter(Boolean).join(' — ');
      return `${head || `Asset #${id}`}${sn}`;
    }
    return `Asset #${id}`;
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
          this.inventoryAssetsChanged.emit();
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
          this.successMsg = '✅ Asset unassigned — back in available stock';
          this.loadAll();
          this.inventoryAssetsChanged.emit();
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
          this.inventoryAssetsChanged.emit();
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
