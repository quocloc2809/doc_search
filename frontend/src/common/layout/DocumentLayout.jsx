import Header from '@/common/layout/Header';
import { APP_ROUTES } from '@/common/routing/routes';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link, Outlet, useLocation } from 'react-router-dom';

const DocumentLayout = () => {
    const location = useLocation();

    return (
        <div>
            <Header />
            <div className='page-wrapper page-wrapper-top'>
                <div className='panel panel-wide panel-full-height'>
                    <Tabs value={location.pathname} className='w-full mb-4'>
                        <TabsList
                            variant='line'
                            className='bg-background rounded-none border-b p-0'>
                            <Link
                                title='Văn bản đến'
                                to={APP_ROUTES.INCOMING_DOCUMENTS}>
                                <TabsTrigger
                                    value={APP_ROUTES.INCOMING_DOCUMENTS}
                                    className='w-full'>
                                    Văn bản đến
                                </TabsTrigger>
                            </Link>
                            <Link
                                title='Văn bản đi'
                                to={APP_ROUTES.OUTGOING_DOCUMENTS}>
                                <TabsTrigger
                                    value={APP_ROUTES.OUTGOING_DOCUMENTS}
                                    className='w-full'>
                                    Văn bản đi
                                </TabsTrigger>
                            </Link>
                        </TabsList>
                    </Tabs>
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default DocumentLayout;
