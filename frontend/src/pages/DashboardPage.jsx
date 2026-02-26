import { useNavigate } from 'react-router-dom'
import { getAuthUser, logout } from '../common/auth/authService'
import { APP_ROUTES } from '../common/routing/routes'
import Button from '../common/ui/Button'

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = getAuthUser()

  const handleLogout = () => {
    logout()
    navigate(APP_ROUTES.LOGIN, { replace: true })
  }

  return (
    <div className="page-wrapper">
      <div className="panel">
        <div className="row-between">
          <h2>Dashboard</h2>
          <Button onClick={handleLogout}>Đăng xuất</Button>
        </div>

        <p>Xin chào: <strong>{user?.fullName || user?.username || 'Người dùng'}</strong></p>
        <p>Vai trò: {user?.role || 'user'}</p>
        <p>Frontend common modules đã sẵn sàng để mở rộng.</p>
        <Button onClick={() => navigate(APP_ROUTES.INCOMING_DOCUMENTS)}>Xem văn bản đến</Button>
        <Button onClick={() => navigate(APP_ROUTES.OUTGOING_DOCUMENTS)}>Xem văn bản đi</Button>
      </div>
    </div>
  )
}
