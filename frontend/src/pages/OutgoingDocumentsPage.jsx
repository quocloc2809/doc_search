import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    useDepartments,
    useFileDownload,
    useOutgoingDocuments,
    useAvailableDocumentYears,
} from '../common/hooks';
import { CommonTable } from '../common/table';
import { ErrorMessage, SearchBar } from '../common/ui';
import {
    buildDocumentDownloadTitle,
    formatDate,
    normalizeText,
} from '@/common/utils';
import './OutgoingDocumentsPage.css';
import { Eye, Download, FileDown, CheckSquare } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import CustomSelect from '@/components/custom/CustomSelect';
import FilterDialog from '@/components/filter/FilterDialog';
import { toast } from 'sonner';

const SEARCH_FIELDS = [
    { value: 'all', label: 'Tất cả' },
    { value: 'DocumentNo', label: 'Số hiệu' },
    { value: 'DocumentSummary', label: 'Trích yếu' },
    { value: 'SignerFullname', label: 'Người ký' },
];

function parseRowDate(value) {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function OutgoingDocumentsPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const urlYear = searchParams.get('year');
    const initialYear = urlYear && /^\d{4}$/.test(urlYear) ? urlYear : null;
    const { documents, isLoading, error, setParams } = useOutgoingDocuments(
        initialYear ? { year: initialYear } : {},
    );
    const { years: availableYears } = useAvailableDocumentYears();
    const {
        departments,
        error: departmentsError,
        refetch: refetchDepartments,
    } = useDepartments();
    const {
        isDownloading,
        error: downloadError,
        downloadOutgoingFile,
    } = useFileDownload();
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchField, setSearchField] = useState('all');
    const [filters, setFilters] = useState(() => ({
        department: 'all',
        year: initialYear || 'all',
        dateDay: '',
        dateMonth: '',
        dateYear: '',
    }));
    const [draftFilters, setDraftFilters] = useState(() => ({
        department: 'all',
        year: initialYear || 'all',
        dateDay: '',
        dateMonth: '',
        dateYear: '',
    }));
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [isBulkDownloading, setIsBulkDownloading] = useState(false);

    const handleDownload = useCallback(
        async row => {
            try {
                const downloadTitle = buildDocumentDownloadTitle(
                    row?.DocumentNo,
                    row?.SignedDate || row?.CreatedDate,
                );
                const selectedYear =
                    filters.year !== 'all' ? filters.year : undefined;

                await downloadOutgoingFile(
                    row?.DocumentID,
                    row?.SourceDb,
                    downloadTitle,
                    selectedYear,
                );
            } catch {
                return null;
            }
        },
        [downloadOutgoingFile, filters.year],
    );

    const handleResetFilters = () => {
        setDraftFilters(filters);
    };

    const handleOpenFilters = () => {
        handleResetFilters();
        refetchDepartments();
    };

    const handleApplyFilters = () => {
        setFilters(draftFilters);
    };

    // Keep year filter in URL so navigating to detail and back won't reset.
    // Also send year to backend for server-side filtering + selecting correct DB.
    useEffect(() => {
        const next = new URLSearchParams(searchParams);
        let changed = false;

        if (filters.year === 'all') {
            if (next.has('year')) {
                next.delete('year');
                changed = true;
            }
        } else if (next.get('year') !== filters.year) {
            next.set('year', filters.year);
            changed = true;
        }

        // `db` is only meaningful on the detail route; keep list URL clean.
        if (next.has('db')) {
            next.delete('db');
            changed = true;
        }

        if (changed) {
            setSearchParams(next, { replace: true });
        }

        setParams(prev => {
            const prevYear = prev?.year;

            if (filters.year === 'all') {
                return prevYear ? {} : prev || {};
            }

            return prevYear === filters.year ? prev : { year: filters.year };
        });
    }, [filters.year, searchParams, setSearchParams, setParams]);

    useEffect(() => {
        if (downloadError) {
            toast.error(downloadError);
        }
    }, [downloadError]);

    const handleOutGoingDetail = (id, sourceDb) => {
        const next = new URLSearchParams(searchParams);
        // Ensure URL reflects current filter at the time of navigation
        if (filters.year === 'all') next.delete('year');
        else next.set('year', filters.year);

        // If year is not selected, pass db so the backend can find the record.
        if (filters.year === 'all' && sourceDb) {
            next.set('db', sourceDb);
        } else {
            next.delete('db');
        }

        navigate(`/outgoing-documents/${id}?${next.toString()}`);
    };

    const yearOptions = useMemo(() => {
        const configuredYearsRaw = import.meta?.env?.VITE_DOC_YEARS;
        if (configuredYearsRaw) {
            return String(configuredYearsRaw)
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
                .filter(y => /^\d{4}$/.test(y))
                .sort((a, b) => Number(b) - Number(a));
        }

        if (availableYears && availableYears.length > 0) {
            return availableYears;
        }

        const currentYear = new Date().getFullYear();
        const startYear = 2020;
        const years = [];
        for (let y = currentYear; y >= startYear; y -= 1) {
            years.push(String(y));
        }
        return years;
    }, [availableYears]);

    const filteredDocuments = useMemo(() => {
        const keyword = normalizeText(searchKeyword).toLowerCase();

        return documents.filter(row => {
            const createdDate = new Date(row?.CreatedDate);
            const rowYear = Number.isNaN(createdDate.getTime())
                ? ''
                : String(createdDate.getFullYear());
            const rawGroupId = row?.IssuedGroupID;
            const rowDepartmentId =
                rawGroupId != null ? String(Math.abs(rawGroupId)) : '';
            const rowDate = parseRowDate(row?.SignedDate || row?.CreatedDate);

            const matchesDepartment =
                filters.department === 'all'
                    ? true
                    : rowDepartmentId === filters.department;

            const matchesYear =
                filters.year === 'all' ? true : rowYear === filters.year;

            const searchableValues =
                searchField === 'DocumentNo'
                    ? [row?.DocumentNo]
                    : searchField === 'DocumentSummary'
                      ? [row?.DocumentSummary]
                      : searchField === 'SignerFullname'
                        ? [row?.SignerFullname]
                        : [
                              row?.DocumentNo,
                              row?.DocumentSummary,
                              row?.SignerFullname,
                              row?.GroupName,
                          ];

            const matchesKeyword = keyword
                ? searchableValues.some(value =>
                      normalizeText(value).toLowerCase().includes(keyword),
                  )
                : true;

            const hasDateFilter =
                filters.dateDay || filters.dateMonth || filters.dateYear;
            const matchesDate = hasDateFilter
                ? rowDate
                    ? (filters.dateDay
                          ? rowDate.getDate() ===
                            parseInt(filters.dateDay, 10)
                          : true) &&
                      (filters.dateMonth
                          ? rowDate.getMonth() + 1 ===
                            parseInt(filters.dateMonth, 10)
                          : true) &&
                      (filters.dateYear
                          ? rowDate.getFullYear() ===
                            parseInt(filters.dateYear, 10)
                          : true)
                    : false
                : true;

            return (
                matchesDepartment &&
                matchesYear &&
                matchesKeyword &&
                matchesDate
            );
        });
    }, [
        documents,
        filters.department,
        filters.dateDay,
        filters.dateMonth,
        filters.dateYear,
        filters.year,
        searchKeyword,
        searchField,
    ]);
    const allFilteredIds = useMemo(
        () => filteredDocuments.map(doc => doc.DocumentID),
        [filteredDocuments],
    );

    const allSelected =
        allFilteredIds.length > 0 &&
        allFilteredIds.every(id => selectedIds.has(id));
    const someSelected =
        !allSelected && allFilteredIds.some(id => selectedIds.has(id));
    const selectedCount = allFilteredIds.filter(id =>
        selectedIds.has(id),
    ).length;

    const handleToggleSelect = useCallback(id => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const handleSelectAll = useCallback(() => {
        if (allSelected) {
            setSelectedIds(prev => {
                const next = new Set(prev);
                allFilteredIds.forEach(id => next.delete(id));
                return next;
            });
        } else {
            setSelectedIds(prev => {
                const next = new Set(prev);
                allFilteredIds.forEach(id => next.add(id));
                return next;
            });
        }
    }, [allSelected, allFilteredIds]);

    const handleBulkDownload = useCallback(async () => {
        const selectedDocs = filteredDocuments.filter(doc =>
            selectedIds.has(doc.DocumentID),
        );
        if (selectedDocs.length === 0) {
            toast.error('Chưa chọn văn bản nào');
            return;
        }
        setIsBulkDownloading(true);
        let successCount = 0;
        for (const doc of selectedDocs) {
            try {
                await handleDownload(doc);
                successCount += 1;
            } catch {
                // continue downloading remaining files
            }
        }
        setIsBulkDownloading(false);
        toast.success(`Đã tải ${successCount}/${selectedDocs.length} văn bản`);
    }, [filteredDocuments, selectedIds, handleDownload]);

    const handleExport = useCallback(() => {
        if (filteredDocuments.length === 0) {
            toast.error('Không có dữ liệu để xuất');
            return;
        }
        const headers = [
            'Số hiệu',
            'Trích yếu',
            'Ngày tạo',
            'Người ký',
            'Đơn vị ban hành',
            'Ngày ký',
        ];
        const escape = val =>
            `"${String(val || '').replace(/"/g, '""')}"`;
        const csvRows = [
            headers.join(','),
            ...filteredDocuments.map(row =>
                [
                    escape(row.DocumentNo),
                    escape(row.DocumentSummary),
                    escape(formatDate(row.CreatedDate)),
                    escape(row.SignerFullname),
                    escape(row.GroupName),
                    escape(formatDate(row.SignedDate)),
                ].join(','),
            ),
        ];
        const csvContent = '\uFEFF' + csvRows.join('\n');
        const blob = new Blob([csvContent], {
            type: 'text/csv;charset=utf-8',
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `danh-sach-van-ban-di-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }, [filteredDocuments]);
    const selectAllRef = useRef(null);
    useEffect(() => {
        if (selectAllRef.current) {
            selectAllRef.current.indeterminate = someSelected;
        }
    }, [someSelected]);

    const columns = [
        {
            key: 'select',
            title: (
                <input
                    ref={selectAllRef}
                    type='checkbox'
                    className='outgoing-checkbox'
                    checked={allSelected}
                    onChange={handleSelectAll}
                    aria-label='Chọn tất cả'
                />
            ),
            tooltip: false,
            getSearchValue: () => '',
            render: row => (
                <input
                    type='checkbox'
                    className='outgoing-checkbox'
                    checked={selectedIds.has(row.DocumentID)}
                    onChange={() => handleToggleSelect(row.DocumentID)}
                    aria-label='Chọn văn bản'
                />
            ),
        },
        {
            key: 'DocumentNo',
            title: 'Số hiệu',
            render: row => (
                <span
                    className='font-semibold hover:underline hover:cursor-pointer'
                    onClick={() => handleOutGoingDetail(row.DocumentID, row.SourceDb)}>
                    {row.DocumentNo}
                </span>
            ),
        },
        {
            key: 'DocumentSummary',
            title: 'Trích yếu',
        },
        {
            key: 'CreatedDate',
            title: 'Ngày tạo',
            render: row => formatDate(row.CreatedDate),
        },
        { key: 'SignerFullname', title: 'Người ký' },
        { key: 'GroupName', title: 'Đơn vị ban hành' },
        {
            key: 'SignedDate',
            title: 'Ngày ký',
            render: row => formatDate(row.SignedDate),
        },
        {
            key: 'actions',
            title: 'Thao tác',
            tooltip: false,
            getSearchValue: () => '',
            render: row => (
                <div className='flex gap-1'>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                onClick={() =>
                                    handleOutGoingDetail(row.DocumentID, row.SourceDb)
                                }>
                                <Eye size={12} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side='bottom'>
                            <p>Xem văn bản</p>
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                disabled={isDownloading}
                                onClick={() => handleDownload(row)}>
                                <Download size={12} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side='bottom'>
                            <p>Tải xuống</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            ),
        },
    ];

    const departmentOptions = useMemo(
        () => [
            { value: 'all', label: 'Tất cả đơn vị' },
            ...departments.map(dept => ({
                value: String(dept.GroupID),
                label: dept.GroupName,
            })),
        ],
        [departments],
    );

    const formattedYearOptions = useMemo(
        () => [
            { value: 'all', label: 'Tất cả năm' },
            ...yearOptions.map(year => ({
                value: String(year),
                label: String(year),
            })),
        ],
        [yearOptions],
    );

    if (error || departmentsError) {
        return (
            <ErrorMessage
                message={error || departmentsError}
            />
        );
    }

    return (
        
        <>
            <div className='outgoing-toolbar'>
                <div className='outgoing-toolbar-left'>
                    <SearchBar
                        searchFields={SEARCH_FIELDS}
                        searchField={searchField}
                        onSearchFieldChange={setSearchField}
                        onSearch={keyword => setSearchKeyword(keyword)}
                        placeholder='Tìm kiếm văn bản...'
                        style={{ marginBottom: 0 }}
                    />
                    <div className='outgoing-action-buttons'>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant='outline'
                                    onClick={handleExport}
                                    className='outgoing-export-btn'>
                                    <FileDown size={14} />
                                    <span>Xuất danh sách</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side='bottom'>
                                <p>Xuất danh sách hiện tại ra CSV</p>
                            </TooltipContent>
                        </Tooltip>
                        {selectedCount > 0 && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        disabled={isBulkDownloading || isDownloading}
                                        onClick={handleBulkDownload}
                                        className='outgoing-bulk-download-btn'>
                                        <CheckSquare size={14} />
                                        <span>
                                            Tải {selectedCount} văn bản
                                        </span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side='bottom'>
                                    <p>Tải xuống các văn bản đã chọn</p>
                                </TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                    <FilterDialog
                        handleFilters={handleApplyFilters}
                        handleOpenFilters={handleOpenFilters}>
                        <div className='grid gap-3'>
                            <Label htmlFor='filter-department'>Đơn vị</Label>
                            <CustomSelect
                                id='filter-department'
                                options={departmentOptions}
                                onChange={newValue => {
                                    setDraftFilters(prev => ({
                                        ...prev,
                                        department: newValue
                                            ? newValue.value
                                            : 'all',
                                    }));
                                }}
                                value={draftFilters.department}
                            />
                            <Label htmlFor='filter-year'>Năm</Label>
                            <CustomSelect
                                id='filter-year'
                                options={formattedYearOptions}
                                onChange={newValue => {
                                    setDraftFilters(prev => ({
                                        ...prev,
                                        year: newValue ? newValue.value : 'all',
                                    }));
                                }}
                                value={String(draftFilters.year)}
                            />
                            <Label>Ngày / Tháng / Năm</Label>
                            <div className='grid grid-cols-3 gap-2'>
                                <Input
                                    type='number'
                                    min='1'
                                    max='31'
                                    placeholder='Ngày'
                                    value={draftFilters.dateDay}
                                    onChange={event => {
                                        setDraftFilters(prev => ({
                                            ...prev,
                                            dateDay: event.target.value,
                                        }));
                                    }}
                                />
                                <Input
                                    type='number'
                                    min='1'
                                    max='12'
                                    placeholder='Tháng'
                                    value={draftFilters.dateMonth}
                                    onChange={event => {
                                        setDraftFilters(prev => ({
                                            ...prev,
                                            dateMonth: event.target.value,
                                        }));
                                    }}
                                />
                                <Input
                                    type='number'
                                    min='1900'
                                    max='2100'
                                    placeholder='Năm'
                                    value={draftFilters.dateYear}
                                    onChange={event => {
                                        setDraftFilters(prev => ({
                                            ...prev,
                                            dateYear: event.target.value,
                                        }));
                                    }}
                                />
                            </div>
                        </div>
                    </FilterDialog>
                </div>
                <div className='filter-pill'>
                    Đơn vị:{' '}
                    <strong>
                        {filters.department === 'all'
                            ? 'Tất cả'
                            : departments.find(
                                  item =>
                                      String(item.GroupID) ===
                                      filters.department,
                              )?.GroupName || 'Không xác định'}
                    </strong>
                    {' | '}
                    Năm:{' '}
                    <strong>
                        {filters.year === 'all' ? 'Tất cả' : filters.year}
                    </strong>
                    {' | '}
                    Ngày:{' '}
                    <strong>
                        {filters.dateDay || filters.dateMonth || filters.dateYear
                            ? [
                                  filters.dateDay
                                      ? filters.dateDay.padStart(2, '0')
                                      : '--',
                                  filters.dateMonth
                                      ? filters.dateMonth.padStart(2, '0')
                                      : '--',
                                  filters.dateYear || '----',
                              ].join('/')
                            : 'Tất cả'}
                    </strong>
                </div>
            </div>
            <CommonTable
                columns={columns}
                data={filteredDocuments}
                tableWidth={0}
                responsive
                longColumns={{
                    2: 420,
                    5: 260,
                    7: 130,
                }}
                minAutoColumnWidth={88}
                rowKey='DocumentID'
                searchable={false}
                pagination
                autoPageSize={false}
                initialPageSize={20}
                pageSizeOptions={[5, 10, 20, 50, 100]}
                emptyText='Không có văn bản đi'
                isLoading={isLoading}
            />
        </>
    );
}
