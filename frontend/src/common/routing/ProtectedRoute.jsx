import { Navigate, Outlet } from 'react-router-dom'
import { APP_ROUTES } from './routes'
import { hasValidSession } from '../auth/authService'

export default function ProtectedRoute() {
  if (!hasValidSession()) {
    return <Navigate to={APP_ROUTES.LOGIN} replace />
  }

  return <Outlet />
}
