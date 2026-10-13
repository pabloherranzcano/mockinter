import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard, onboardedGuard } from './core/guards';

export const routes: Routes = [
  { path: 'entrar', canActivate: [guestGuard], loadComponent: () => import('./pages/login').then((m) => m.LoginPage), title: 'Entrar · Racha' },
  { path: 'privacidad', loadComponent: () => import('./pages/privacy').then((m) => m.PrivacyPage), title: 'Privacidad · Racha' },
  { path: 'empezar', canActivate: [authGuard], loadComponent: () => import('./pages/onboarding').then((m) => m.OnboardingPage), title: 'Tu preparación · Racha' },
  { path: 'ajustes', canActivate: [authGuard], loadComponent: () => import('./pages/settings').then((m) => m.SettingsPage), title: 'Ajustes · Racha' },
  { path: 'leccion/:topicId', canActivate: [onboardedGuard], loadComponent: () => import('./pages/lesson').then((m) => m.LessonPage), title: 'Lección · Racha' },
  { path: 'repaso', canActivate: [onboardedGuard], data: { review: true }, loadComponent: () => import('./pages/lesson').then((m) => m.LessonPage), title: 'Repaso · Racha' },
  {
    path: 'admin', canActivate: [adminGuard],
    loadComponent: () => import('./admin/admin-layout').then((m) => m.AdminLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'reportes' },
      { path: 'reportes', loadComponent: () => import('./admin/reports').then((m) => m.AdminReports), title: 'Reportes · Admin' },
      { path: 'preguntas', loadComponent: () => import('./admin/questions').then((m) => m.AdminQuestions), title: 'Preguntas · Admin' },
      { path: 'preguntas/:id', loadComponent: () => import('./admin/question-editor').then((m) => m.QuestionEditor), title: 'Editar pregunta · Admin' },
    ],
  },
  { path: '', pathMatch: 'full', canActivate: [onboardedGuard], loadComponent: () => import('./pages/home').then((m) => m.HomePage), title: 'Racha' },
  { path: '**', redirectTo: '' },
];
