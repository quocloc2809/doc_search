import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    useDepartments,
    useFileDownload,
    useIncomingDocuments,
    useAvailableDocumentYears,
} from '../common/hooks';
import { CommonTable } from '../common/table';
import { ErrorMessage, SearchBar } from '../common/ui';
import { formatDate, normalizeText } from '../common/utils';
import './IncomingDocumentsPage.css';
import { Eye, Download } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import CustomSelect from '@/components/custom/CustomSelect';
import FilterDialog from '@/components/filter/FilterDialog';

const SEARCH_FIELDS = [
    { value: 'all', label: 'Tất cả' },
    { value: 'DocumentNo', label: 'Số hiệu' },
    { value: 'DocumentSummary', label: 'Trích yếu' },
];

export default function IncomingDocumentsPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const urlYear = searchParams.get('year');
    const initialYear = urlYear && /^\d{4}$/.test(urlYear) ? urlYear : null;
    const { documents, isLoading, error, setParams } = useIncomingDocuments(
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
        downloadIncomingFile,
    } = useFileDownload();
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchField, setSearchField] = useState('all');
    const [filters, setFilters] = useState(() => ({
        department: 'all',
        year: initialYear || 'all',
    }));
    const [draftFilters, setDraftFilters] = useState(filters);

    const handleDownload = useCallback(
        async (documentId, sourceDb) => {
            try {
                await downloadIncomingFile(documentId, sourceDb);
            } catch {
                return null;
            }
        },
        [downloadIncomingFile],
    );

    const handleOpenFilters = () => {
        handleResetFilters();
        refetchDepartments();
    };

    const handleResetFilters = () => {
        setDraftFilters(filters);
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

    const handleIncomingDetail = (id, sourceDb) => {
        const next = new URLSearchParams(searchParams);
        if (filters.year === 'all') next.delete('year');
        else next.set('year', filters.year);
        // If year is not selected, pass db so the backend can find the record.
        if (filters.year === 'all' && sourceDb) {
            next.set('db', sourceDb);
        } else {
            next.delete('db');
        }

        navigate(`/incoming-documents/${id}?${next.toString()}`);
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
            const rowDepartmentId = String(Math.abs(row?.AssignedGroupID ?? 0));

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
                      : [
                            row?.DocumentNo,
                            row?.DocumentSummary,
                            row?.LeaderName,
                            row?.GroupName,
                        ];

            const matchesKeyword = keyword
                ? searchableValues.some(value =>
                      normalizeText(value).toLowerCase().includes(keyword),
                  )
                : true;

            return matchesDepartment && matchesYear && matchesKeyword;
        });
    }, [
        documents,
        filters.department,
        filters.year,
        searchKeyword,
        searchField,
    ]);

    const columns = [
        {
            key: 'DocumentNo',
            title: 'Số hiệu',
            render: row => (
                <p
                    className='font-semibold hover:cursor-pointer hover:underline'
                    onClick={() => handleIncomingDetail(row.DocumentID, row.SourceDb)}>
                    {row.DocumentNo}
                </p>
            ),
        },
        { key: 'DocumentSummary', title: 'Trích yếu' },
        {
            key: 'CreatedDate',
            title: 'Ngày tạo',
            render: row => formatDate(row.CreatedDate),
        },
        { key: 'LeaderName', title: 'Lãnh đạo bút phê' },
        { key: 'GroupName', title: 'Đơn vị xử lý chính' },
        {
            key: 'ExpiredDate',
            title: 'Ngày hết hạn',
            render: row => formatDate(row.ExpiredDate),
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
                                    handleIncomingDetail(row.DocumentID, row.SourceDb)
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
                                onClick={() => handleDownload(row.DocumentID, row.SourceDb)}>
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

    if (error || departmentsError || downloadError) {
        return (
            <ErrorMessage
                message={error || departmentsError || downloadError}
            />
        );
    }

    return (
        <>
            <div className='incoming-toolbar'>
                <div className='incoming-toolbar-left'>
                    <SearchBar
                        searchFields={SEARCH_FIELDS}
                        searchField={searchField}
                        onSearchFieldChange={setSearchField}
                        onSearch={keyword => setSearchKeyword(keyword)}
                        placeholder='Tìm kiếm văn bản...'
                        style={{ marginBottom: 0 }}
                    />
                    <FilterDialog
                        handleFilters={handleApplyFilters}
                        handleOpenFilters={handleOpenFilters}>
                        <div className='grid gap-3'>
                            <Label htmlFor='filter-department'>Đơn vị</Label>
                            <CustomSelect
                                id='filter-department'
                                options={departmentOptions}
                                onChange={newValue =>
                                    setDraftFilters(prev => ({
                                        ...prev,
                                        department: newValue.value,
                                    }))
                                }
                                value={draftFilters.department}
                            />
                            <Label htmlFor='filter-year'>Năm</Label>
                            <CustomSelect
                                id='filter-year'
                                options={formattedYearOptions}
                                onChange={newValue =>
                                    setDraftFilters(prev => ({
                                        ...prev,
                                        year: newValue.value,
                                    }))
                                }
                                value={String(draftFilters.year)}
                            />
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
                </div>
            </div>
            <CommonTable
                columns={columns}
                data={filteredDocuments}
                tableWidth={0}
                responsive
                longColumns={{
                    1: 420,
                    4: 260,
                    6: 130,
                }}
                minAutoColumnWidth={88}
                rowKey='DocumentID'
                searchable={false}
                pagination
                autoPageSize={false}
                initialPageSize={20}
                pageSizeOptions={[5, 15, 20]}
                emptyText='Không có văn bản đến'
                isLoading={isLoading}
            />
        </>
    );
}
