import Spinner from '@/components/loading/Spinner';

function TableLoading() {
    return (
        <div className='absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-white/75 backdrop-blur-[1px]'>
            <Spinner />
            <span className='text-sm font-medium text-gray-500'>
                Đang tải dữ liệu...
            </span>
        </div>
    );
}

export default TableLoading;
