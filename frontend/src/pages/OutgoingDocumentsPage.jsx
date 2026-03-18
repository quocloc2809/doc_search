import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    useDepartments,
    useFileDownload,
    useOutgoingDocuments,
} from '../common/hooks';
import { APP_ROUTES } from '../common/routing/routes';
import { CommonTable } from '../common/table';
import { Button, ErrorMessage, LoadingSpinner, SearchBar } from '../common/ui';
import { formatDateTime, normalizeText } from '@/common/utils';
import './OutgoingDocumentsPage.css';

const SEARCH_FIELDS = [
    { value: 'all', label: 'Tất cả' },
    { value: 'DocumentNo', label: 'Số hiệu' },
    { value: 'DocumentSummary', label: 'Trích yếu' },
];

export default function OutgoingDocumentsPage() {
    const navigate = useNavigate();
    const { documents, isLoading, error, refetch } = useOutgoingDocuments();
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
    const [isFilterOpen, setIsFilterOpen] = useState(false);
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

    const handleOpenFilters = () => {
        setDraftFilters(filters);
        setIsFilterOpen(true);
        refetchDepartments();
    };

    const handleCloseFilters = () => {
        setIsFilterOpen(false);
        setDraftFilters(filters);
    };

    const handleApplyFilters = () => {
        setFilters(draftFilters);
        setIsFilterOpen(false);
    };

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
            const rowDepartmentId = String(row?.IssuedGroupID ?? '');

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
    const columns = useMemo(
        () => [
            {
                key: 'DocumentNo',
                title: 'Số hiệu',
                render: row => (
                    <p className='font-semibold'>{row.DocumentNo}</p>
                ),
            },
            { key: 'DocumentSummary', title: 'Trích yếu' },
            {
                key: 'CreatedDate',
                title: 'Ngày tạo',
                render: row => formatDateTime(row.CreatedDate),
            },
            { key: 'SignerFullname', title: 'Người ký' },
            { key: 'GroupName', title: 'Đơn vị ban hành' },
            {
                key: 'SignedDate',
                title: 'Ngày ký',
                render: row => formatDateTime(row.SignedDate),
            },
            {
                key: 'actions',
                title: 'Thao tác',
                tooltip: false,
                getSearchValue: () => '',
                render: row => (
                    <Button
                        type='button'
                        disabled={isDownloading}
                        onClick={() => handleDownload(row.DocumentID)}>
                        Tải về
                    </Button>
                ),
            },
        ],
        [handleDownload, isDownloading],
    );

    return (
        <div className='page-wrapper page-wrapper-top'>
            <div className='panel panel-wide panel-full-height'>
                <div className='row-between'>
                    <h2 className='uppercase text-lg font-bold'>VĂN BẢN ĐI</h2>
                    <div className='row-between' style={{ gap: '8px' }}>
                        <Button onClick={() => refetch()}>Tải lại</Button>
                        <Button onClick={() => navigate(APP_ROUTES.HOME)}>
                            Về Dashboard
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <LoadingSpinner text='Đang tải văn bản đi...' />
                ) : null}
                <ErrorMessage
                    message={error || departmentsError || downloadError}
                />

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
                        <Button
                            className='button-filter'
                            onClick={handleOpenFilters}>
                            Bộ lọc
                        </Button>
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
                    initialPageSize={15}
                    pageSizeOptions={[15]}
                    emptyText='Không có văn bản đi'
                />

                {isFilterOpen ? (
                    <div
                        className='filter-overlay'
                        onClick={handleCloseFilters}>
                        <div
                            className='filter-modal'
                            onClick={event => event.stopPropagation()}>
                            <div className='filter-header'>
                                <h3>Bộ lọc dữ liệu</h3>
                                <button
                                    type='button'
                                    className='filter-close'
                                    onClick={handleCloseFilters}>
                                    ×
                                </button>
                            </div>

                            <div className='filter-grid'>
                                <label htmlFor='filter-department'>
                                    Đơn vị
                                    <select
                                        id='filter-department'
                                        value={draftFilters.department}
                                        onChange={event =>
                                            setDraftFilters(prev => ({
                                                ...prev,
                                                department: event.target.value,
                                            }))
                                        }>
                                        <option value='all'>
                                            Tất cả đơn vị
                                        </option>
                                        {departments.map(department => (
                                            <option
                                                key={department.GroupID}
                                                value={String(
                                                    department.GroupID,
                                                )}>
                                                {department.GroupName}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label htmlFor='filter-year'>
                                    Năm
                                    <select
                                        id='filter-year'
                                        value={draftFilters.year}
                                        onChange={event =>
                                            setDraftFilters(prev => ({
                                                ...prev,
                                                year: event.target.value,
                                            }))
                                        }>
                                        <option value='all'>Tất cả năm</option>
                                        {yearOptions.map(year => (
                                            <option key={year} value={year}>
                                                {year}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div className='filter-actions'>
                                <Button
                                    className='button-muted'
                                    onClick={handleCloseFilters}>
                                    Hủy
                                </Button>
                                <Button
                                    className='button-filter'
                                    onClick={handleApplyFilters}>
                                    Áp dụng
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
