import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './common/routing/ProtectedRoute';
import { APP_ROUTES } from './common/routing/routes';
import IncomingDocumentsPage from './pages/IncomingDocumentsPage';
import OutgoingDocumentsPage from './pages/OutgoingDocumentsPage';
import IncomingDetailPage from '@/pages/IncomingDetailPage';
import OutgoingDetailPage from './pages/OutgoingDetailPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import DocumentLayout from '@/common/layout/DocumentLayout';

function App() {
    return (
        <Routes>
            <Route path={APP_ROUTES.LOGIN} element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
                <Route
                    path={APP_ROUTES.HOME}
                    element={
                        <Navigate to={APP_ROUTES.INCOMING_DOCUMENTS} replace />
                    }
                />
                <Route element={<DocumentLayout />}>
                    <Route
                        path={APP_ROUTES.INCOMING_DOCUMENTS}
                        element={<IncomingDocumentsPage />}
                    />
                    <Route
                        path={APP_ROUTES.OUTGOING_DOCUMENTS}
                        element={<OutgoingDocumentsPage />}
                    />
                </Route>
                <Route
                    path={APP_ROUTES.INCOMING_DOCUMENT_DETAIL}
                    element={<IncomingDetailPage />}
                />
                <Route
                    path={APP_ROUTES.OUTGOING_DOCUMENT_DETAIL}
                    element={<OutgoingDetailPage />}
                />
                <Route
                    path={APP_ROUTES.ADMIN}
                    element={<AdminPage />}
                />
            </Route>
            <Route path='*' element={<NotFoundPage />} />
            <Route
                path='/home'
                element={<Navigate to={APP_ROUTES.HOME} replace />}
            />
        </Routes>
    );
}

export default App;
