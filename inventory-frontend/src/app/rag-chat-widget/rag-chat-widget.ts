import { Component, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { apiUrl } from '../api-url';
import { AuthService } from '../auth.service';

type ChatMsg = { role: 'user' | 'assistant'; text: string };

@Component({
  selector: 'app-rag-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './rag-chat-widget.html',
  styleUrl: './rag-chat-widget.css',
})
export class RagChatWidget {
  private readonly base = apiUrl('rag');

  open = false;
  input = '';
  loading = false;
  error = '';
  messages: ChatMsg[] = [];

  constructor(
    private http: HttpClient,
    public auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  @HostListener('document:keydown', ['$event'])
  onKey(ev: KeyboardEvent) {
    if (ev.key === 'Escape' && this.open) {
      this.open = false;
      this.cdr.detectChanges();
    }
  }

  toggle() {
    this.open = !this.open;
    this.error = '';
    this.cdr.detectChanges();
  }

  close() {
    this.open = false;
    this.cdr.detectChanges();
  }

  send() {
    const q = (this.input || '').trim();
    if (!q || this.loading) return;
    this.messages = [...this.messages, { role: 'user', text: q }];
    this.input = '';
    this.loading = true;
    this.error = '';
    this.cdr.detectChanges();

    this.http
      .post<{ answer?: string }>(`${this.base}/chat`, { question: q }, this.auth.getAuthHeaders())
      .subscribe({
        next: (res) => {
          this.loading = false;
          const a = (res.answer || '').trim() || '—';
          this.messages = [...this.messages, { role: 'assistant', text: a }];
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.loading = false;
          this.error =
            typeof err.error === 'string'
              ? err.error
              : err.error?.detail || err.error?.message || 'Request failed';
          this.messages = [
            ...this.messages,
            { role: 'assistant', text: `Error: ${this.error}` },
          ];
          this.cdr.detectChanges();
        },
      });
  }
}
