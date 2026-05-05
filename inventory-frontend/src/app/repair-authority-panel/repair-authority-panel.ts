import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { apiUrl } from '../api-url';

@Component({
  selector: 'app-repair-authority-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './repair-authority-panel.html',
  styleUrl: './repair-authority-panel.css',
})
export class RepairAuthorityPanel implements OnInit {
  private readonly api = apiUrl('');

  queue: any[] = [];
  loading = false;
  errorMsg = '';
  successMsg = '';

  dialog: any = null;
  step: 'ask' | 'details' = 'ask';
  repairCost = '';
  repairNotes = '';
  billFile: File | null = null;
  billName = '';
  saving = false;
  @ViewChild('billInput') billInput?: ElementRef<HTMLInputElement>;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.http.get<any[]>(`${this.api}/repairs/authority-queue`).subscribe({
      next: (rows) => {
        const list = Array.isArray(rows) ? rows : [];
        for (const r of list) {
          if (r && r.status === 'WithAuthority') r.status = 'Under repair';
        }
        this.queue = list;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.message || 'Could not load queue';
        this.cdr.detectChanges();
      },
    });
  }

  deviceLabel(r: any): string {
    return `${r.asset_type || 'Asset'} — ${r.brand || ''} ${r.model || ''}`.trim();
  }

  openFix(r: any) {
    this.errorMsg = '';
    this.dialog = { ...r };
    this.step = 'ask';
    this.repairCost = '';
    this.repairNotes = '';
    this.billFile = null;
    this.billName = '';
    const el = this.billInput?.nativeElement;
    if (el) el.value = '';
    this.cdr.detectChanges();
  }

  closeDialog() {
    if (this.saving) return;
    this.dialog = null;
    this.cdr.detectChanges();
  }

  goDetails() {
    this.step = 'details';
    this.cdr.detectChanges();
  }

  onBill(ev: Event) {
    const inp = ev.target as HTMLInputElement;
    const f = inp.files?.[0] ?? null;
    this.billFile = f;
    this.billName = f ? f.name : '';
    this.cdr.detectChanges();
  }

  markFixedQuick() {
    this.putFixedJson();
  }

  submitDetails() {
    const raw = String(this.repairCost ?? '').trim();
    if (raw !== '') {
      const n = parseFloat(raw);
      if (Number.isNaN(n) || n < 0) {
        this.errorMsg = 'Invalid cost';
        this.cdr.detectChanges();
        return;
      }
    }
    const cost = raw === '' ? null : parseFloat(raw);
    const notes = String(this.repairNotes ?? '').trim() || null;
    this.putFixedForm(cost, notes);
  }

  private putFixedJson() {
    if (!this.dialog) return;
    const id = Number(this.dialog.id);
    this.saving = true;
    this.http.put(`${this.api}/repairs/update/${id}`, { status: 'Fixed', repair_cost: null, repair_notes: null }).subscribe({
      next: () => this.afterSave(),
      error: (err) => this.failSave(err),
    });
  }

  private putFixedForm(cost: number | null, notes: string | null) {
    if (!this.dialog) return;
    const id = Number(this.dialog.id);
    this.saving = true;
    const fd = new FormData();
    fd.append('status', 'Fixed');
    fd.append('repair_cost', cost === null || cost === undefined ? '' : String(cost));
    fd.append('repair_notes', notes ?? '');
    if (this.billFile) {
      fd.append('repair_bill', this.billFile, this.billFile.name);
    }
    this.http.put(`${this.api}/repairs/update/${id}`, fd).subscribe({
      next: () => this.afterSave(),
      error: (err) => this.failSave(err),
    });
  }

  cannotFix() {
    if (!this.dialog) return;
    const id = Number(this.dialog.id);
    const note = window.prompt('Brief reason (sent to admin / notes):', 'Cannot repair — parts NLA');
    if (note === null) return;
    this.saving = true;
    this.http
      .put(`${this.api}/repairs/update/${id}`, {
        status: 'CannotRepair',
        repair_notes: note,
      })
      .subscribe({
        next: () => this.afterSave(),
        error: (err) => this.failSave(err),
      });
  }

  private afterSave() {
    this.saving = false;
    this.dialog = null;
    this.successMsg = 'Updated ✅';
    this.load();
    this.cdr.detectChanges();
    setTimeout(() => {
      this.successMsg = '';
      this.cdr.detectChanges();
    }, 2500);
  }

  private failSave(err: any) {
    this.saving = false;
    this.errorMsg = err.error?.message || 'Update failed';
    this.cdr.detectChanges();
  }
}
