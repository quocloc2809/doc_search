import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../common/api';
import { saveLoginSession, hasValidSession } from '../common/auth/authService';
import { APP_ROUTES } from '../common/routing/routes';
import Button from '../common/ui/Button';
import ErrorMessage from '../common/ui/ErrorMessage';
import Input from '../common/ui/Input';
import { isRequired } from '../common/utils';
import Spinner from '@/components/loading/Spinner';

export default function LoginPage() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        username: '',
        password: '',
    });
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (hasValidSession()) {
            navigate(APP_ROUTES.HOME, { replace: true });
        }
    }, [navigate]);

    const handleChange = event => {
        const { name, value } = event.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async event => {
        event.preventDefault();
        setError('');

        if (!isRequired(formData.username) || !isRequired(formData.password)) {
            setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu');
            return;
        }

        setIsSubmitting(true);

        try {
            const result = await authApi.login(formData);

            if (!result?.success || !result?.data?.accessToken) {
                setError(result?.message || 'Đăng nhập thất bại');
                return;
            }

            saveLoginSession(result.data);
            navigate(APP_ROUTES.HOME, { replace: true });
        } catch (apiError) {
            setError(
                apiError?.response?.data?.message ||
                    'Không thể kết nối máy chủ',
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className='flex min-h-screen w-full items-center justify-center bg-linear-to-br from-blue-600 to-blue-900'>
            <form className='panel' onSubmit={handleSubmit}>
                <h2 className='text-center font-bold text-lg'>Đăng nhập</h2>
                <Input
                    name='username'
                    label='Tài khoản'
                    value={formData.username}
                    onChange={handleChange}
                    placeholder='Nhập tài khoản'
                    autoComplete='username'
                />
                <Input
                    name='password'
                    type='password'
                    label='Mật khẩu'
                    value={formData.password}
                    onChange={handleChange}
                    placeholder='Nhập mật khẩu'
                    autoComplete='current-password'
                />
                <ErrorMessage message={error} />
                <Button
                    type='submit'
                    disabled={isSubmitting}
                    className='w-full flex items-center justify-center gap-2'>
                    {isSubmitting && <Spinner />} Đăng nhập
                </Button>
            </form>
        </div>
    );
}
