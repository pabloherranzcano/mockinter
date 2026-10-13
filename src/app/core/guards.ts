import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService), router = inject(Router);
  await auth.ready;
  return auth.session() ? true : router.createUrlTree(['/entrar']);
};

/** Requiere sesión y haber completado el onboarding. */
export const onboardedGuard: CanActivateFn = async () => {
  const auth = inject(AuthService), router = inject(Router);
  await auth.ready;
  if (!auth.session()) return router.createUrlTree(['/entrar']);
  if (!auth.profile()) await auth.loadProfile();
  return auth.profile()?.onboarded ? true : router.createUrlTree(['/empezar']);
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService), router = inject(Router);
  await auth.ready;
  return auth.session() ? router.createUrlTree(['/']) : true;
};

/** Solo administradores. La seguridad real está en la base de datos; esto solo evita mostrar la pantalla. */
export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService), router = inject(Router);
  await auth.ready;
  if (!auth.profile()) await auth.loadProfile();
  return auth.isAdmin() ? true : router.createUrlTree(['/']);
};
