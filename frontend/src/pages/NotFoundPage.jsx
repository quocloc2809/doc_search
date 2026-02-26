import { Link } from 'react-router-dom'
import { APP_ROUTES } from '../common/routing/routes'

export default function NotFoundPage() {
  return (
    <div className="page-wrapper">
      <div className="panel">
        <h2>404</h2>
        <p>Không tìm thấy trang.</p>
        <Link to={APP_ROUTES.HOME}>Quay về trang chủ</Link>
      </div>
    </div>
  )
}
