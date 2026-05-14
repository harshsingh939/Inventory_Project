import { ApplicationConfig } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
// import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withFetch,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { routes } from './app.routes';
import { AuthInterceptor } from './auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      }),
    ),
    // provideClientHydration(withEventReplay()),
    /** Default XHR backend parses 4xx JSON bodies reliably for public flows (e.g. email-fulfill). */
    provideHttpClient(withInterceptorsFromDi(), withFetch()),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ]
};