import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    useDepartments,
    useFileDownload,
    useOutgoingDocuments,
} from '../common/hooks';
import { CommonTable } from '../common/table';
import { ErrorMessage, SearchBar } from '../common/ui';
import { formatDate, normalizeText } from '@/common/utils';
import './OutgoingDocumentsPage.css';
import { Eye, Download } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import CustomSelect from '@/components/custom/CustomSelect';
import FilterDialog from '@/components/filter/FilterDialog';

const SEARCH_FIELDS = [
    { value: 'all', label: 'Tất cả' },
    { value: 'DocumentNo', label: 'Số hiệu' },
    { value: 'DocumentSummary', label: 'Trích yếu' },
];

export default function OutgoingDocumentsPage() {
    const navigate = useNavigate();
    const { documents, isLoading, error } = useOutgoingDocuments();
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
    const [filters, setFilters] = useState({
        department: 'all',
        year: 'all',
    });
    const [draftFilters, setDraftFilters] = useState(filters);

    const handleDownload = useCallback(
        async documentId => {
            try {
                await downloadOutgoingFile(documentId);
            } catch {
                return null;
            }
        },
        [downloadOutgoingFile],
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

    const handleOutGoingDetail = id => navigate(`/outgoing-documents/${id}`);

    const yearOptions = useMemo(() => {
        const yearSet = new Set();

        documents.forEach(row => {
            const date = new Date(row?.CreatedDate);
            if (!Number.isNaN(date.getTime())) {
                yearSet.add(String(date.getFullYear()));
            }
        });

        return [...yearSet].sort((a, b) => Number(b) - Number(a));
    }, [documents]);

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
                            row?.SignerFullname,
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
                    className='font-semibold hover:underline hover:cursor-pointer'
                    onClick={() => handleOutGoingDetail(row.DocumentID)}>
                    {row.DocumentNo}
                </p>
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
                                    handleOutGoingDetail(row.DocumentID)
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
                                onClick={() => handleDownload(row.DocumentID)}>
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
                emptyText='Không có văn bản đi'
                isLoading={isLoading}
            />
        </>
    );
}
