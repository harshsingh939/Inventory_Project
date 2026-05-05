import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

/** Old `/sessions` URL → category page with assignment panel open (admin only via route guard). */
@Component({
  selector: 'app-sessions-redirect',
  standalone: true,
  template: '',
})
export class SessionsRedirect implements OnInit {
  private readonly router = inject(Router);

  ngOnInit() {
    void this.router.navigate(['/assets', 'systems'], {
      queryParams: { assign: '1' },
      replaceUrl: true,
    });
  }
}
