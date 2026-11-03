import { ApplicationConfig } from '@angular/core';
import { provideRouter, RouteReuseStrategy, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ListRouteReuseStrategy } from './router/list-route-reuse.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    { provide: RouteReuseStrategy, useClass: ListRouteReuseStrategy },
    provideAnimations(),
  ],
};
