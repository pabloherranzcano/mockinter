import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { GuestOnly, RequireAdmin, RequireAuth, RequireOnboarded } from './auth/guards';

const Login = lazy(() => import('./pages/Login'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Settings = lazy(() => import('./pages/Settings'));
const Home = lazy(() => import('./pages/Home'));
const Lesson = lazy(() => import('./pages/Lesson'));
const AdminLayout = lazy(() => import('./admin/AdminLayout'));
const AdminReports = lazy(() => import('./admin/AdminReports'));
const AdminQuestions = lazy(() => import('./admin/AdminQuestions'));
const QuestionEditor = lazy(() => import('./admin/QuestionEditor'));

const TITLES: [RegExp, string][] = [
  [/^\/entrar/, 'Entrar'], [/^\/privacidad/, 'Privacidad'], [/^\/empezar/, 'Tu preparación'],
  [/^\/ajustes/, 'Ajustes'], [/^\/leccion/, 'Lección'], [/^\/repaso/, 'Repaso'], [/^\/admin/, 'Admin'],
];

function DocumentTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const t = TITLES.find(([re]) => re.test(pathname))?.[1];
    document.title = t ? `${t} · mockinter` : 'mockinter.dev';
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <BrowserRouter>
      <DocumentTitle />
      <Suspense fallback={<main className="wrap"><p className="muted">Cargando…</p></main>}>
        <Routes>
          <Route element={<GuestOnly />}>
            <Route path="/entrar" element={<Login />} />
          </Route>
          <Route path="/privacidad" element={<Privacy />} />
          <Route element={<RequireAuth />}>
            <Route path="/empezar" element={<Onboarding />} />
            <Route path="/ajustes" element={<Settings />} />
          </Route>
          <Route element={<RequireOnboarded />}>
            <Route path="/" element={<Home />} />
            <Route path="/leccion/:topicId" element={<Lesson />} />
            <Route path="/repaso" element={<Lesson review />} />
          </Route>
          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="reportes" replace />} />
              <Route path="reportes" element={<AdminReports />} />
              <Route path="preguntas" element={<AdminQuestions />} />
              <Route path="preguntas/:id" element={<QuestionEditor />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
