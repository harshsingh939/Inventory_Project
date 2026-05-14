import { Component, inject } from '@angular/core';
import { ToastService } from '../toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [],
  templateUrl: './toast-container.html',
  styleUrl: './toast-container.css',
})
export class ToastContainer {
  readonly toast = inject(ToastService);
}
