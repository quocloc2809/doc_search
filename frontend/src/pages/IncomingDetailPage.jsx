import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { APP_ROUTES } from '@/common/routing/routes';
import { Link } from 'react-router-dom';
import { Paperclip, Download } from 'lucide-react';
import { useIncomingDocumentDetail } from '@/common/hooks/useIncomingDocumentDetail';
import { ErrorMessage, LoadingSpinner } from '@/common/ui';
import Header from '@/common/layout/Header';
import { formatDate } from '@/common/utils';
import DocumentDetailSkeleton from '@/components/loading/DocumentDetailSkeleton';
import { Separator } from '@/components/ui/separator';

function IncomingDetailPage() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const year = searchParams.get('year');
    const db = searchParams.get('db');
    const detailParams = useMemo(() => {
        const params = {};
        if (year && /^\d{4}$/.test(year)) params.year = year;
        if (db) params.db = db;
        return params;
    }, [year, db]);

    const { document, isLoading, error } = useIncomingDocumentDetail(
        id,
        detailParams,
    );

    const backPath = useMemo(() => {
        if (year && /^\d{4}$/.test(year)) {
            return `${APP_ROUTES.INCOMING_DOCUMENTS}?year=${year}`;
        }
        return APP_ROUTES.INCOMING_DOCUMENTS;
    }, [year]);

    const infoFields = useMemo(
        () => [
            ['Số hiệu', document?.DocumentNo],
            ['Ngày đến', formatDate(document?.ReceivedDate)],
            ['Sổ văn bản', document?.BookName],
            [
                'Ban hành',
                document?.IssuedOrganizationName ||
                    document?.issuedOrganizationName2,
            ],
        ],
        [document],
    );

    const infoInFields = useMemo(
        () => [
            ['Lãnh đạo bút phê', document?.LeaderName],
            ['Đơn vị xử lý chính', document?.GroupName],
            ['Người xử lý chính', document?.AssignedUserName],
        ],
        [document],
    );

    if (isLoading) {
        return <DocumentDetailSkeleton />;
    }

    if (error) {
        return <ErrorMessage message={error} />;
    }

    return (
        <div className='min-h-dvh-screen bg-slate-100 font-sans'>
            <Header backPath={backPath} isDetail />
            <div className='bg-white border-b border-gray-200'>
                <div className='max-w-7xl mx-auto px-8 py-2.5 flex gap-2 items-center text-xs text-gray-500'>
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem>
                                <BreadcrumbLink asChild>
                                    <Link to={backPath}>
                                        Văn bản đến
                                    </Link>
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbPage>
                                    {document?.DocumentSummary}
                                </BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            </div>
            <div className='max-w-7xl mx-auto px-8 py-7'>
                <div className='flex gap-6 items-start flex-wrap lg:flex-nowrap'>
                    <div className='flex-3 min-w-0'>
                        <div className='bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-5'>
                            <div
                                className={`bg-linear-to-br from-blue-900 to-blue-600 p-8`}>
                                <div className='flex items-center gap-5'>
                                    <div>
                                        <p className='text-white/70 text-xs font-medium uppercase tracking-widest mb-1.5'>
                                            Văn bản đến
                                        </p>
                                        <p className='text-white text-2xl font-extrabold leading-tight'>
                                            {document?.DocumentNo}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className='px-8 py-6'>
                                <p className='text-xs text-gray-400 font-bold uppercase tracking-widest mb-3'>
                                    Trích yếu nội dung
                                </p>
                                <p
                                    className={`text-red-600 text-base font-semibold leading-relaxed border-l-4 pl-4 `}>
                                    {document?.DocumentSummary}
                                </p>
                            </div>
                            <Separator />
                            <div className='grid grid-cols-3 gap-2 relative'>
                                <div className='px-8 py-6 border-b border-gray-100 col-span-1'>
                                    <p className='text-xs text-gray-400 font-bold uppercase tracking-widest mb-4'>
                                        Thông tin chung
                                    </p>
                                    <div className='grid gap-3'>
                                        {infoFields.map(([k, v]) => (
                                            <div
                                                key={k}
                                                className='bg-gray-50 rounded-xl p-4 border border-gray-100'>
                                                <p className='text-xs text-gray-400 font-semibold mb-1.5'>
                                                    {k}
                                                </p>
                                                <p className='font-semibold text-sm text-gray-800'>
                                                    {v || '\u00A0'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className='absolute left-1/3 top-6 bottom-6 flex items-center'>
                                    <Separator orientation='vertical' />
                                </div>
                                <div className='px-8 py-6 border-b border-gray-100 col-span-2'>
                                    <p className='text-xs text-gray-400 font-bold uppercase tracking-widest mb-4'>
                                        Thông tin nhận văn bản
                                    </p>
                                    <div className='grid grid-cols-2 gap-3'>
                                        {infoInFields.map(([k, v]) => (
                                            <div
                                                key={k}
                                                className='bg-gray-50 rounded-xl p-4 border border-gray-100'>
                                                <p className='text-xs text-gray-400 font-semibold mb-1.5'>
                                                    {k}
                                                </p>
                                                <p className='font-semibold text-sm text-gray-800'>
                                                    {v || '\u00A0'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className='w-64 lg:w-full shrink-0 flex flex-col gap-4'>
                            <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-5'>
                                <p className='text-xs text-gray-400 font-bold uppercase tracking-widest mb-4'>
                                    <Paperclip className='inline-block mr-2 h-4 w-4' />
                                    File đính kèm
                                </p>
                                <div className='border-2 border-dashed border-gray-200 rounded-xl p-5 text-center'>
                                    <p className='text-4xl mb-2'>📄</p>
                                    <p className='text-indigo-600 font-semibold text-xs mb-4 break-all'>
                                        {document?.FileName?.split(
                                            /[\\/]/,
                                        ).pop() || 'Không có file đính kèm'}
                                    </p>
                                    <button className='w-full py-2.5 bg-linear-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white text-sm font-bold rounded-lg transition cursor-pointer border-none'>
                                        <Download className='inline-block mr-2 h-4 w-4' />
                                        Tải xuống
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default IncomingDetailPage;
