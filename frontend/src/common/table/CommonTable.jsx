import { isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import { Pagination, SearchBar, Tooltip } from '../ui';
import { calculateTableLayout } from './calculateTableLayout';
import { normalizeText } from '@/common/utils/text-helper';
import { useNavigate } from 'react-router-dom';
import { APP_ROUTES } from '@/common/routing/routes';

function defaultGetCellValue(row, column) {
    if (!column?.key) {
        return '';
    }
    return row?.[column.key];
}

export default function CommonTable({
    columns = [],
    data = [],
    tableWidth = 0,
    longColumns = [],
    minAutoColumnWidth = 80,
    rowKey = 'id',
    responsive = true,
    autoPageSize = false,
    minAutoRows = 8,
    maxAutoRows = 50,
    rowHeightEstimate = 40,
    autoRowFitOffset = 8,
    searchable = true,
    searchPlaceholder = 'Tìm kiếm trong bảng...',
    onSearch,
    pagination = true,
    initialPage = 1,
    initialPageSize = 10,
    pageSizeOptions = [10, 20, 50],
    tableMaxHeight = '',
    emptyText = 'Không có dữ liệu',
    showOverflowHint = true,
}) {
    const [page, setPage] = useState(initialPage);
    const [pageSize, setPageSize] = useState(initialPageSize);
    const [autoPageSizeValue, setAutoPageSizeValue] = useState(initialPageSize);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [containerWidth, setContainerWidth] = useState(0);
    const tableWrapperRef = useRef(null);
    const tableScrollRef = useRef(null);
    const navigate = useNavigate();

    const safeColumns = useMemo(
        () => (Array.isArray(columns) ? columns : []),
        [columns],
    );
    const safeData = useMemo(() => (Array.isArray(data) ? data : []), [data]);
    const minTableWidth = useMemo(
        () => Math.max(0, Number(tableWidth) || 0),
        [tableWidth],
    );

    useEffect(() => {
        if (!responsive) {
            return undefined;
        }

        const wrapperNode = tableWrapperRef.current;
        const scrollNode = tableScrollRef.current;
        const node = scrollNode || wrapperNode;
        if (!node) {
            return undefined;
        }

        const updateWidth = () => {
            const width = Math.floor(node.getBoundingClientRect().width);
            if (width > 0) {
                setContainerWidth(width);
            }
        };

        updateWidth();

        const resizeObserver = new ResizeObserver(() => {
            updateWidth();
        });

        resizeObserver.observe(node);

        return () => {
            resizeObserver.disconnect();
        };
    }, [responsive]);

    useEffect(() => {
        if (!autoPageSize) {
            return undefined;
        }

        const node = tableScrollRef.current;
        if (!node) {
            return undefined;
        }

        const minRows = Math.max(1, Number(minAutoRows) || 1);
        const maxRows = Math.max(minRows, Number(maxAutoRows) || minRows);
        const fallbackRowHeight = Math.max(24, Number(rowHeightEstimate) || 40);
        const fitOffset = Math.max(0, Number(autoRowFitOffset) || 0);

        const updateRows = () => {
            const headerElement = node.querySelector('thead');
            const firstRowElement = node.querySelector('tbody tr');

            const headerHeight = Math.ceil(
                headerElement?.getBoundingClientRect().height || 44,
            );
            const measuredRowHeight = Math.ceil(
                firstRowElement?.getBoundingClientRect().height ||
                    fallbackRowHeight,
            );
            const availableBodyHeight = Math.max(
                0,
                Math.floor(node.clientHeight - headerHeight),
            );

            if (availableBodyHeight <= 0) {
                return;
            }

            const safeRowHeight = Math.max(1, measuredRowHeight);
            const baseRows = Math.floor(
                (availableBodyHeight + fitOffset) / safeRowHeight,
            );
            const remainder = availableBodyHeight % safeRowHeight;
            const extraRow = remainder >= safeRowHeight * 0.45 ? 1 : 0;
            const estimatedRows = baseRows + extraRow;
            const nextRows = Math.max(
                minRows,
                Math.min(maxRows, estimatedRows),
            );

            setAutoPageSizeValue(nextRows);
        };

        updateRows();

        const resizeObserver = new ResizeObserver(() => {
            updateRows();
        });

        resizeObserver.observe(node);

        return () => {
            resizeObserver.disconnect();
        };
    }, [
        autoPageSize,
        autoRowFitOffset,
        maxAutoRows,
        minAutoRows,
        rowHeightEstimate,
        safeData.length,
        safeColumns.length,
    ]);

    const layout = useMemo(() => {
        if (safeColumns.length === 0) {
            return null;
        }

        const widthFromContainer = containerWidth > 0 ? containerWidth : 1;
        const targetWidth = responsive
            ? Math.max(widthFromContainer, minTableWidth)
            : Math.max(minTableWidth, 1);

        return calculateTableLayout({
            columnCount: safeColumns.length,
            tableWidth: targetWidth,
            longColumns,
            minAutoColumnWidth,
            fitToTableWidth: true,
            minColumnWidth: 40,
        });
    }, [
        containerWidth,
        longColumns,
        minAutoColumnWidth,
        minTableWidth,
        responsive,
        safeColumns.length,
    ]);

    const filteredRows = useMemo(() => {
        const keyword = normalizeText(searchKeyword).toLowerCase();

        if (!keyword) {
            return safeData;
        }

        return safeData.filter(row => {
            return safeColumns.some(column => {
                const rawValue = column.getSearchValue
                    ? column.getSearchValue(row)
                    : defaultGetCellValue(row, column);

                return normalizeText(rawValue).toLowerCase().includes(keyword);
            });
        });
    }, [safeColumns, safeData, searchKeyword]);

    const effectivePageSize = autoPageSize ? autoPageSizeValue : pageSize;

    const totalItems = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);

    const pagedRows = useMemo(() => {
        if (!pagination) {
            return filteredRows;
        }

        const start = (safePage - 1) * effectivePageSize;
        return filteredRows.slice(start, start + effectivePageSize);
    }, [effectivePageSize, filteredRows, pagination, safePage]);

    const handleSearch = keyword => {
        const nextKeyword = keyword || '';
        setSearchKeyword(nextKeyword);
        setPage(1);
        onSearch?.(nextKeyword);
    };

    const handlePageChange = nextPage => {
        setPage(nextPage);
    };

    const handlePageSizeChange = nextPageSize => {
        setPageSize(nextPageSize);
        setPage(1);
    };

    if (safeColumns.length === 0) {
        return (
            <div className='common-error'>CommonTable cần ít nhất 1 cột</div>
        );
    }

    if (!layout) {
        return null;
    }

    const handleDetail = id => {
        navigate(APP_ROUTES.OUTGOING_DOCUMENT_DETAIL.replace(':id', id));
    };

    const renderedTableWidth = layout.tableWidth;
    const tableScrollStyle =
        autoPageSize || !tableMaxHeight
            ? undefined
            : { maxHeight: tableMaxHeight };

    return (
        <div className='common-table-wrapper' ref={tableWrapperRef}>
            {searchable ? (
                <SearchBar
                    value={searchKeyword}
                    onSearch={handleSearch}
                    placeholder={searchPlaceholder}
                />
            ) : null}

            <div
                className='common-table-scroll'
                ref={tableScrollRef}
                style={tableScrollStyle}>
                <table
                    className='common-table'
                    style={{ width: `${renderedTableWidth}px` }}>
                    <colgroup>
                        {layout.columnStyles.map((style, index) => (
                            <col key={`col-${index}`} style={style} />
                        ))}
                    </colgroup>
                    <thead>
                        <tr>
                            {safeColumns.map((column, index) => (
                                <th key={column.key || `head-${index}`}>
                                    {column.title || `Cột ${index + 1}`}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {pagedRows.length === 0 ? (
                            <tr>
                                <td colSpan={safeColumns.length}>
                                    {emptyText}
                                </td>
                            </tr>
                        ) : (
                            pagedRows.map((row, rowIndex) => (
                                <tr
                                    key={row?.[rowKey] ?? `row-${rowIndex}`}
                                    className='cursor-pointer'
                                    onClick={() =>
                                        handleDetail(row.DocumentID)
                                    }>
                                    {safeColumns.map((column, columnIndex) => {
                                        const rawValue = column.render
                                            ? column.render(row, rowIndex)
                                            : defaultGetCellValue(row, column);

                                        const isCustomNode =
                                            isValidElement(rawValue);

                                        if (isCustomNode) {
                                            return (
                                                <td
                                                    key={`${column.key || columnIndex}-${row?.[rowKey] ?? rowIndex}`}>
                                                    <div className='common-table-cell'>
                                                        {rawValue}
                                                    </div>
                                                </td>
                                            );
                                        }

                                        const textValue =
                                            normalizeText(rawValue);
                                        const isTooltipEnabled =
                                            column.tooltip !== false &&
                                            textValue.length > 0;
                                        const lineClamp =
                                            Number(column.lineClamp) > 1
                                                ? Number(column.lineClamp)
                                                : 1;
                                        const textClassName =
                                            lineClamp > 1
                                                ? 'common-table-text common-table-text-multiline'
                                                : 'common-table-text';
                                        const textStyle =
                                            lineClamp > 1
                                                ? { WebkitLineClamp: lineClamp }
                                                : undefined;

                                        return (
                                            <td
                                                key={`${column.key || columnIndex}-${row?.[rowKey] ?? rowIndex}`}>
                                                <div className='common-table-cell'>
                                                    {isTooltipEnabled ? (
                                                        <Tooltip
                                                            content={textValue}>
                                                            <span
                                                                className={
                                                                    textClassName
                                                                }
                                                                style={
                                                                    textStyle
                                                                }>
                                                                {textValue ||
                                                                    '-'}
                                                            </span>
                                                        </Tooltip>
                                                    ) : (
                                                        <span
                                                            className={
                                                                textClassName
                                                            }
                                                            style={textStyle}>
                                                            {textValue || '-'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showOverflowHint && layout.overflowWidth > 0 ? (
                <div className='common-pagination-info'>
                    Bảng đang vượt kích thước {layout.overflowWidth}px. Bạn có
                    thể kéo ngang để xem đầy đủ.
                </div>
            ) : null}

            {pagination ? (
                <Pagination
                    page={safePage}
                    pageSize={effectivePageSize}
                    totalItems={totalItems}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                    pageSizeOptions={
                        autoPageSize ? [effectivePageSize] : pageSizeOptions
                    }
                    disablePageSizeSelect={autoPageSize}
                    showPageSizeSelect={false}
                />
            ) : null}
        </div>
    );
}
