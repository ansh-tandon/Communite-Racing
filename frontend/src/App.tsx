import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/layout';
import { Skeleton } from './components/ui';
import { useAuth } from './hooks/useAuth';
import { AdminNewRacePage, AdminRacePage, AdminRacesPage } from './pages/AdminPages';
import HomePage from './pages/HomePage';
// Logged-in visits never need the login page's code.
const LoginPage = lazy(() => import('./pages/LoginPage'));
import { LeaderboardPage, NotFoundPage, ProfilePage } from './pages/PeoplePages';
import QuizArenaPage, { QuizIndex } from './pages/QuizArenaPage';
import { RaceHubPage, RacesPage } from './pages/RacePages';

function RequireAuth() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="mx-auto max-w-7xl p-6"><Skeleton className="h-[60vh]" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <Outlet />;
}

function RequireAdmin() {
  const { user } = useAuth();
  return user?.is_admin ? <Outlet /> : <NotFoundPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Suspense fallback={<div className="min-h-dvh bg-bg" />}><LoginPage /></Suspense>} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="races" element={<RacesPage />} />
          <Route path="races/:id" element={<RaceHubPage />} />
          <Route path="quiz" element={<QuizIndex />} />
          <Route path="quiz/:id" element={<QuizArenaPage />} />
          <Route path="standings" element={<LeaderboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="admin" element={<RequireAdmin />}>
            <Route index element={<AdminRacesPage />} />
            <Route path="new" element={<AdminNewRacePage />} />
            <Route path="races/:id" element={<AdminRacePage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
