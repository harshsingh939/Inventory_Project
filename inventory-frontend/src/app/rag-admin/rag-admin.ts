import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { apiUrl } from '../api-url';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-rag-admin',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './rag-admin.html',
  styleUrl: './rag-admin.css',
})
export class RagAdmin {
  private readonly base = apiUrl('rag');

  statusJson: unknown = null;
  statusLoading = false;
  statusError = '';

  reindexLoading = false;
  reindexMessage = '';
  reindexError = '';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  private opts() {
    return this.auth.getAuthHeaders();
  }

  loadStatus() {
    this.statusLoading = true;
    this.statusError = '';
    this.http.get<unknown>(`${this.base}/status`, this.opts()).subscribe({
      next: (data) => {
        this.statusJson = data;
        this.statusLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.statusLoading = false;
        this.statusError = err.error?.message || err.message || 'Failed to load status';
        this.cdr.detectChanges();
      },
    });
  }

  reindex() {
    this.reindexLoading = true;
    this.reindexError = '';
    this.reindexMessage = '';
    this.http.post<unknown>(`${this.base}/reindex`, {}, this.opts()).subscribe({
      next: (data) => {
        this.reindexLoading = false;
        this.reindexMessage = 'Done.';
        this.statusJson = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.reindexLoading = false;
        this.reindexError =
          typeof err.error === 'string'
            ? err.error
            : err.error?.detail || err.error?.message || 'Reindex failed';
        this.cdr.detectChanges();
      },
    });
  }
}
