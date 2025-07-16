import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.isAdmin().pipe(
    map(isAdmin => {
      if (isAdmin) {
        return true;
      } else {
        router.navigate(['/login']);
        return false;
      }
    })
  );
};
