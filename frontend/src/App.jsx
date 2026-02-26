import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './common/routing/ProtectedRoute'
import { APP_ROUTES } from './common/routing/routes'
import DashboardPage from './pages/DashboardPage'
import IncomingDocumentsPage from './pages/IncomingDocumentsPage'
import OutgoingDocumentsPage from './pages/OutgoingDocumentsPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'

function App() {
  return (
    <Routes>
      <Route path={APP_ROUTES.LOGIN} element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path={APP_ROUTES.HOME} element={<DashboardPage />} />
        <Route path={APP_ROUTES.INCOMING_DOCUMENTS} element={<IncomingDocumentsPage />} />
        <Route path={APP_ROUTES.OUTGOING_DOCUMENTS} element={<OutgoingDocumentsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
      <Route path="/home" element={<Navigate to={APP_ROUTES.HOME} replace />} />
    </Routes>
  )
}

export default App
