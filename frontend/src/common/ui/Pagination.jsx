import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from 'lucide-react';
import { usePaginationPages } from '@/common/hooks/usePaginationPages';

export default function Pagination({
    page,
    pageSize,
    totalItems,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 20, 50],
    disablePageSizeSelect = false,
    // showPageSizeSelect = true,
}) {
    const safeTotalItems = Math.max(0, Number(totalItems) || 0);
    const safePageSize = Math.max(1, Number(pageSize) || 10);
    const totalPages = Math.max(1, Math.ceil(safeTotalItems / safePageSize));
    const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const pageNumbers = usePaginationPages(currentPage, totalPages);

    const start =
        safeTotalItems === 0 ? 0 : (currentPage - 1) * safePageSize + 1;
    const end = Math.min(currentPage * safePageSize, safeTotalItems);

    return (
        <div className='common-pagination'>
            <div className='common-pagination-info'>
                Hiển thị {start}-{end} / {safeTotalItems}
            </div>

            <div className='common-pagination-controls'>
                <div className='flex items-center gap-2'>
                    <Select
                        modal={false}
                        disabled={disablePageSizeSelect}
                        value={String(safePageSize)}
                        onValueChange={value =>
                            onPageSizeChange?.(Number(value))
                        }>
                        <SelectTrigger className='h-8 w-17.5'>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent
                            side='top'
                            className='w-[--radix-select-trigger-width]'>
                            {pageSizeOptions.map(pageSize => (
                                <SelectItem
                                    key={pageSize}
                                    value={`${pageSize}`}>
                                    {pageSize}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className='flex items-center gap-1'>
                    <Button
                        variant='secondary'
                        disabled={currentPage <= 1}
                        onClick={() => onPageChange?.(1)}>
                        <ChevronsLeft className='h-4 w-4' />
                    </Button>
                    <Button
                        variant='secondary'
                        disabled={currentPage <= 1}
                        onClick={() => onPageChange?.(currentPage - 1)}>
                        <ChevronLeft className='h-4 w-4' />
                    </Button>
                    {pageNumbers.map((p, i) =>
                        p === '...' ? (
                            <span
                                key={`ellipsis-${i}`}
                                className='px-2 text-gray-400 text-sm select-none'>
                                …
                            </span>
                        ) : (
                            <Button
                                variant={p === page ? '' : 'outline'}
                                key={p}
                                onClick={() => onPageChange?.(p)}
                                className={`
                ${
                    p === page
                        ? 'text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-200 disabled:cursor-not-allowed'
                }`}>
                                {p}
                            </Button>
                        ),
                    )}
                    <Button
                        variant='secondary'
                        disabled={currentPage >= totalPages}
                        onClick={() => onPageChange?.(currentPage + 1)}>
                        <ChevronRight className='h-4 w-4' />
                    </Button>
                    <Button
                        variant='secondary'
                        disabled={currentPage >= totalPages}
                        onClick={() => onPageChange?.(totalPages)}>
                        <ChevronsRight className='h-4 w-4' />
                    </Button>
                </div>
            </div>
        </div>
    );
}
