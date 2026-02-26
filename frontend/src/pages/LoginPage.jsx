import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../common/api'
import { saveLoginSession, hasValidSession } from '../common/auth/authService'
import { APP_ROUTES } from '../common/routing/routes'
import Button from '../common/ui/Button'
import ErrorMessage from '../common/ui/ErrorMessage'
import Input from '../common/ui/Input'
import LoadingSpinner from '../common/ui/LoadingSpinner'
import { isRequired } from '../common/utils'

export default function LoginPage() {
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (hasValidSession()) {
      navigate(APP_ROUTES.HOME, { replace: true })
    }
  }, [navigate])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!isRequired(formData.username) || !isRequired(formData.password)) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await authApi.login(formData)

      if (!result?.success || !result?.data?.accessToken) {
        setError(result?.message || 'Đăng nhập thất bại')
        return
      }

      saveLoginSession(result.data)
      navigate(APP_ROUTES.HOME, { replace: true })
    } catch (apiError) {
      setError(apiError?.response?.data?.message || 'Không thể kết nối máy chủ')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-wrapper">
      <form className="panel" onSubmit={handleSubmit}>
        <h2>Đăng nhập hệ thống</h2>
        <p>Dùng tài khoản backend để truy cập.</p>

        <ErrorMessage message={error} />

        <Input
          name="username"
          label="Tên đăng nhập"
          value={formData.username}
          onChange={handleChange}
          placeholder="Nhập tên đăng nhập"
          autoComplete="username"
        />

        <Input
          name="password"
          type="password"
          label="Mật khẩu"
          value={formData.password}
          onChange={handleChange}
          placeholder="Nhập mật khẩu"
          autoComplete="current-password"
        />

        {isSubmitting ? <LoadingSpinner text="Đang đăng nhập..." /> : null}

        <Button type="submit" disabled={isSubmitting}>
          Đăng nhập
        </Button>
      </form>
    </div>
  )
}
