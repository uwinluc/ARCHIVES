import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationsProvider } from './contexts/NotificationsContext'
import { ToastProvider } from './contexts/ToastContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { ErrorBoundary } from './components/ErrorBoundary'

const LoginPage         = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const DashboardPage     = lazy(() => import('./pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const DocumentsPage     = lazy(() => import('./pages/documents/DocumentsPage').then((m) => ({ default: m.DocumentsPage })))
const DocumentDetailPage = lazy(() => import('./pages/documents/DocumentDetailPage').then((m) => ({ default: m.DocumentDetailPage })))
const RecherchePage     = lazy(() => import('./pages/recherche/RecherchePage').then((m) => ({ default: m.RecherchePage })))
const CategoriesPage    = lazy(() => import('./pages/categories/CategoriesPage').then((m) => ({ default: m.CategoriesPage })))
const UsersPage         = lazy(() => import('./pages/users/UsersPage').then((m) => ({ default: m.UsersPage })))
const FilialessPage     = lazy(() => import('./pages/filiales/FilialessPage').then((m) => ({ default: m.FilialessPage })))
const PartagesPage      = lazy(() => import('./pages/partages/PartagesPage').then((m) => ({ default: m.PartagesPage })))
const RapportsPage      = lazy(() => import('./pages/rapports/RapportsPage').then((m) => ({ default: m.RapportsPage })))
const KanbanPage        = lazy(() => import('./pages/kanban/KanbanPage').then((m) => ({ default: m.KanbanPage })))
const CorbeilePage      = lazy(() => import('./pages/corbeille/CorbeilePage').then((m) => ({ default: m.CorbeilePage })))
const CalendrierPage    = lazy(() => import('./pages/calendrier/CalendrierPage').then((m) => ({ default: m.CalendrierPage })))
const ConformitePage    = lazy(() => import('./pages/conformite/ConformitePage').then((m) => ({ default: m.ConformitePage })))

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
      <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
      Chargement…
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <ToastProvider>
          <ErrorBoundary>
            <Routes>
              <Route path="/login" element={
                <Suspense fallback={<PageLoader />}><LoginPage /></Suspense>
              } />

              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard"       element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
                  <Route path="/recherche"       element={<Suspense fallback={<PageLoader />}><RecherchePage /></Suspense>} />
                  <Route path="/documents"       element={<Suspense fallback={<PageLoader />}><DocumentsPage /></Suspense>} />
                  <Route path="/documents/:id"   element={<Suspense fallback={<PageLoader />}><DocumentDetailPage /></Suspense>} />
                  <Route path="/categories"      element={<Suspense fallback={<PageLoader />}><CategoriesPage /></Suspense>} />
                  <Route path="/utilisateurs"    element={<Suspense fallback={<PageLoader />}><UsersPage /></Suspense>} />
                  <Route path="/filiales"        element={<Suspense fallback={<PageLoader />}><FilialessPage /></Suspense>} />
                  <Route path="/partages"        element={<Suspense fallback={<PageLoader />}><PartagesPage /></Suspense>} />
                  <Route path="/rapports"        element={<Suspense fallback={<PageLoader />}><RapportsPage /></Suspense>} />
                  <Route path="/kanban"          element={<Suspense fallback={<PageLoader />}><KanbanPage /></Suspense>} />
                  <Route path="/corbeille"       element={<Suspense fallback={<PageLoader />}><CorbeilePage /></Suspense>} />
                  <Route path="/calendrier"      element={<Suspense fallback={<PageLoader />}><CalendrierPage /></Suspense>} />
                  <Route path="/conformite"      element={<Suspense fallback={<PageLoader />}><ConformitePage /></Suspense>} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </ErrorBoundary>
        </ToastProvider>
      </NotificationsProvider>
    </AuthProvider>
  )
}
