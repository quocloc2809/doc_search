import { useParams } from 'react-router-dom';
import { useMemo } from 'react';
import { useOutgoingDocumentDetail } from '@/common/hooks/useOutGoingDocumentDetail';
import { Link } from 'react-router-dom';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { APP_ROUTES } from '@/common/routing/routes';
import { Paperclip, Download } from 'lucide-react';
import { ErrorMessage } from '@/common/ui';
import Header from '@/common/layout/Header';
import { formatDate } from '@/common/utils';
import DocumentDetailSkeleton from '@/components/loading/DocumentDetailSkeleton';

function OutgoingDetailPage() {
    const { id } = useParams();
    const { document, isLoading, error } = useOutgoingDocumentDetail(id);

    const infoFields = useMemo(
        () => [
            ['Số hiệu', document?.DocumentNo],
            ['Sổ văn bản', document?.BookName],
            ['Loại văn bản', document?.TypeName],
            ['Đơn vị ban hành', document?.GroupName],
            ['Ngày ban hành', formatDate(document?.SignedDate)],
            ['Người ký', document?.SignerFullname],
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
            <Header backPath={APP_ROUTES.OUTGOING_DOCUMENTS} isDetail />
            <div className='bg-white border-b border-gray-200'>
                <div className='max-w-7xl mx-auto px-8 py-2.5 flex gap-2 items-center text-xs text-gray-500'>
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem>
                                <BreadcrumbLink asChild>
                                    <Link to='/outgoing-documents'>
                                        Văn bản đi
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
                                            Văn bản đi
                                        </p>
                                        <p className='text-white text-2xl font-extrabold leading-tight'>
                                            {document?.DocumentNo}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className='px-8 py-6 border-b border-gray-100'>
                                <p className='text-xs text-gray-400 font-bold uppercase tracking-widest mb-3'>
                                    Trích yếu nội dung
                                </p>
                                <p
                                    className={`text-red-600 text-base font-semibold leading-relaxed border-l-4 pl-4 `}>
                                    {document?.DocumentSummary}
                                </p>
                            </div>

                            <div className='px-8 py-6 border-b border-gray-100'>
                                <p className='text-xs text-gray-400 font-bold uppercase tracking-widest mb-4'>
                                    Thông tin văn bản
                                </p>
                                <div className='grid grid-cols-2 gap-3'>
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

export default OutgoingDetailPage;
