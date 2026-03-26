import { Skeleton } from '@/components/ui/skeleton';

const DocumentDetailSkeleton = () => {
    return (
        <div className='max-w-7xl mx-auto px-8 py-7 animate-pulse'>
            <div className='flex gap-6 items-start flex-wrap lg:flex-nowrap'>
                <div className='flex-3 min-w-0 w-full'>
                    <div className='bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-5'>
                        <div className='bg-gray-200 p-8'>
                            <div className='flex items-center gap-5'>
                                <div className='w-full'>
                                    <Skeleton className='h-3 w-20 mb-2 bg-gray-300' />
                                    <Skeleton className='h-8 w-48 bg-gray-300' />
                                </div>
                            </div>
                        </div>
                        <div className='px-8 py-6 border-b border-gray-100'>
                            <Skeleton className='h-3 w-32 mb-4' />
                            <div className='border-l-4 border-gray-200 pl-4 space-y-2'>
                                <Skeleton className='h-5 w-full' />
                                <Skeleton className='h-5 w-[90%]' />
                            </div>
                        </div>
                        <div className='px-8 py-6'>
                            <Skeleton className='h-3 w-36 mb-6' />
                            <div className='grid grid-cols-2 gap-4'>
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div
                                        key={i}
                                        className='bg-gray-50 rounded-xl p-4 border border-gray-100'>
                                        <Skeleton className='h-3 w-20 mb-2' />
                                        <Skeleton className='h-4 w-32' />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className='w-full lg:w-full shrink-0'>
                        <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-5'>
                            <div className='flex items-center mb-4'>
                                <Skeleton className='h-4 w-4 mr-2' />
                                <Skeleton className='h-3 w-28' />
                            </div>
                            <div className='border-2 border-dashed border-gray-100 rounded-xl p-6 flex flex-col items-center'>
                                <Skeleton className='h-10 w-10 rounded-full mb-3' />
                                <Skeleton className='h-3 w-40 mb-4' />
                                <Skeleton className='h-10 w-full rounded-lg' />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DocumentDetailSkeleton;
