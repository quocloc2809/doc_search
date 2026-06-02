import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuditLogs, useDepartments, useToast, useUsers } from '../common/hooks'
import { logout } from '../common/auth/authService'
import { Button, ErrorMessage, LoadingSpinner, Pagination, SearchBar, Toast } from '../common/ui'
import { formatDateTime } from '../common/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import './AdminPage.css'

const EMPTY_FORM = { username: '', password: '', fullName: '', email: '', role: 'user', groupId: '', isActive: true }

function toISODate(value) {
    return new Date(value).toISOString().slice(0, 10)
}

function normalizeTab(value) {
    return value === 'audit' ? 'audit' : 'users'
}

function normalizeDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
}

function normalizePositiveInt(value, fallback) {
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return fallback
    }
    return parsed
}

const AUDIT_PAGE_SIZE_OPTIONS = [20, 50, 100, 200]
const DEFAULT_AUDIT_PAGE_SIZE = 20

function toSearchableText(value) {
    return String(value || '').toLowerCase().trim()
}

export default function AdminPage() {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { users, isLoading, error, createUser, updateUser, deleteUser } = useUsers()
    const { departments } = useDepartments()
    const toast = useToast()
    const todayAuditDate = toISODate(new Date())
    const [selectedAuditDate, setSelectedAuditDate] = useState(
        normalizeDate(searchParams.get('auditDate')) || todayAuditDate
    )
    const { auditLogs, isLoading: isAuditLoading, error: auditError, meta: auditMeta, refetch: refetchAudit } = useAuditLogs({
        limit: 500,
        date: selectedAuditDate || undefined,
    })

    const [activeTab, setActiveTab] = useState(normalizeTab(searchParams.get('tab'))) // 'users' | 'audit'
    const [auditPage, setAuditPage] = useState(normalizePositiveInt(searchParams.get('auditPage'), 1))
    const [auditPageSize, setAuditPageSize] = useState(
        normalizePositiveInt(searchParams.get('auditPageSize'), DEFAULT_AUDIT_PAGE_SIZE)
    )
    const [usersKeyword, setUsersKeyword] = useState(searchParams.get('usersQ') || '')
    const [auditKeyword, setAuditKeyword] = useState(searchParams.get('auditQ') || '')

    const [modalMode, setModalMode] = useState(null) // 'add' | 'edit'
    const [editTarget, setEditTarget] = useState(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [formError, setFormError] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    const [deleteTarget, setDeleteTarget] = useState(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState('')

    useEffect(() => {
        const query = new URLSearchParams()
        query.set('tab', activeTab)
        if (selectedAuditDate) {
            query.set('auditDate', selectedAuditDate)
        }
        if (usersKeyword.trim()) {
            query.set('usersQ', usersKeyword.trim())
        }
        if (auditKeyword.trim()) {
            query.set('auditQ', auditKeyword.trim())
        }
        query.set('auditPage', String(auditPage))
        query.set('auditPageSize', String(auditPageSize))
        setSearchParams(query, { replace: true })
    }, [activeTab, auditKeyword, auditPage, auditPageSize, selectedAuditDate, setSearchParams, usersKeyword])

    useEffect(() => {
        setAuditPage(1)
    }, [selectedAuditDate])

    const filteredUsers = useMemo(() => {
        const keyword = toSearchableText(usersKeyword)
        if (!keyword) {
            return users
        }

        return users.filter((user) => {
            const roleText = user?.Role === 'admin' ? 'admin' : 'user'
            const statusText = user?.IsActive ? 'hoat dong active' : 'vo hieu inactive'
            const searchable = [
                user?.Username,
                user?.FullName,
                user?.Email,
                user?.GroupName,
                roleText,
                statusText,
            ]
                .map(toSearchableText)
                .join(' ')

            return searchable.includes(keyword)
        })
    }, [users, usersKeyword])

    const filteredAuditLogs = useMemo(() => {
        const keyword = toSearchableText(auditKeyword)
        if (!keyword) {
            return auditLogs
        }

        return auditLogs.filter((item) => {
            const { timestamp, action, ip, username, adminUsername, userId, adminId, ...rest } = item || {}
            const displayUser = adminUsername || username || (adminId != null ? `adminId:${adminId}` : '') || (userId != null ? `userId:${userId}` : '') || '-'
            const detailObj = Object.keys(rest || {}).length ? rest : null
            const detailText = detailObj ? JSON.stringify(detailObj) : ''

            const searchable = [timestamp, action, ip, displayUser, detailText]
                .map(toSearchableText)
                .join(' ')

            return searchable.includes(keyword)
        })
    }, [auditKeyword, auditLogs])

    useEffect(() => {
        setAuditPage(1)
    }, [auditKeyword])

    const totalAuditItems = filteredAuditLogs.length
    const totalAuditPages = Math.max(1, Math.ceil(totalAuditItems / auditPageSize))

    useEffect(() => {
        if (auditPage > totalAuditPages) {
            setAuditPage(totalAuditPages)
        }
    }, [auditPage, totalAuditPages])

    const pagedAuditLogs = useMemo(() => {
        const safePage = Math.min(Math.max(1, auditPage), totalAuditPages)
        const start = (safePage - 1) * auditPageSize
        const end = start + auditPageSize
        return filteredAuditLogs.slice(start, end)
    }, [auditPage, auditPageSize, filteredAuditLogs, totalAuditPages])

    const availableDates = auditMeta?.availableDates || []
    const minAuditDate = availableDates.length > 0 ? availableDates[0] : undefined
    const maxAuditDate = availableDates.length > 0 ? availableDates[availableDates.length - 1] : undefined

    const openAdd = () => {
        setForm(EMPTY_FORM)
        setFormError('')
        setModalMode('add')
    }

    const openEdit = (user) => {
        setEditTarget(user)
        setForm({
            username: user.Username,
            password: '',
            fullName: user.FullName || '',
            email: user.Email || '',
            role: user.Role || 'user',
            groupId: user.GroupID != null ? String(user.GroupID) : '',
            isActive: user.IsActive !== false,
        })
        setFormError('')
        setModalMode('edit')
    }

    const closeModal = () => {
        setModalMode(null)
        setEditTarget(null)
        setFormError('')
    }

    const handleChangeForm = (e) => {
        const { name, value, type, checked } = e.target
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    }

    const handleSave = async () => {
        setFormError('')
        if (!form.fullName.trim()) {
            setFormError('Vui lòng nhập họ tên.')
            return
        }
        if (modalMode === 'add') {
            if (!form.username.trim()) {
                setFormError('Vui lòng nhập tên đăng nhập.')
                return
            }
            if (!form.password || form.password.length < 8) {
                setFormError('Mật khẩu phải có ít nhất 8 ký tự.')
                return
            }
        }
        if (modalMode === 'edit' && form.password && form.password.length < 8) {
            setFormError('Mật khẩu mới phải có ít nhất 8 ký tự.')
            return
        }

        setIsSaving(true)
        try {
            if (modalMode === 'add') {
                await createUser({
                    username: form.username.trim(),
                    password: form.password,
                    fullName: form.fullName.trim(),
                    email: form.email.trim() || undefined,
                    role: form.role,
                    groupId: form.groupId || undefined,
                })
                toast.success('Tạo tài khoản thành công!')
            } else {
                const payload = {
                    fullName: form.fullName.trim(),
                    email: form.email.trim() || undefined,
                    role: form.role,
                    groupId: form.groupId || undefined,
                    isActive: form.isActive,
                }
                if (form.password) {
                    payload.newPassword = form.password
                }
                await updateUser(editTarget.UserID, payload)
                toast.success('Cập nhật tài khoản thành công!')
            }
            closeModal()
        } catch (err) {
            const msg = err?.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.'
            setFormError(msg)
        } finally {
            setIsSaving(false)
        }
    }

    const openDelete = (user) => {
        setDeleteTarget(user)
        setDeleteError('')
    }

    const closeDelete = () => {
        setDeleteTarget(null)
        setDeleteError('')
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        setDeleteError('')
        try {
            await deleteUser(deleteTarget.UserID)
            toast.success(`Đã xoá tài khoản "${deleteTarget.Username}" thành công!`)
            closeDelete()
        } catch (err) {
            setDeleteError(err?.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.')
        } finally {
            setIsDeleting(false)
        }
    }

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    return (
        <div className='page-wrapper page-wrapper-top'>
            <div className='panel-wide panel panel-full-height'>
                <div className='admin-page'>
                    <div className='admin-page-header'>
                        <h1 className='admin-page-title'>Quản trị</h1>
                        <div className='admin-page-header-actions'>
                            {activeTab === 'users' && (
                                <Button onClick={openAdd}>+ Thêm tài khoản</Button>
                            )}
                            {activeTab === 'audit' && (
                                <Button className='common-button-ghost' onClick={refetchAudit} disabled={isAuditLoading}>
                                    {isAuditLoading ? 'Đang tải...' : 'Refresh'}
                                </Button>
                            )}
                            <Button className='common-button-ghost' onClick={handleLogout}>Đăng xuất</Button>
                        </div>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className='admin-tabs w-full flex flex-col flex-1'>
                        <TabsList variant='line' className='bg-background rounded-none border-b p-0'>
                            <TabsTrigger value='users' className='w-full'>
                                Tài khoản
                            </TabsTrigger>
                            <TabsTrigger value='audit' className='w-full'>
                                Audit log
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value='users' className='flex-1 min-h-0'>
                            <div className='admin-users-toolbar'>
                                <SearchBar
                                    value={usersKeyword}
                                    onLiveSearch={(keyword) => setUsersKeyword(keyword)}
                                    placeholder='Tìm tài khoản theo username, họ tên, email...'
                                />
                                <span className='admin-users-toolbar-meta'>
                                    {`Hiển thị ${filteredUsers.length} / ${users.length} tài khoản`}
                                </span>
                            </div>

                            {error && <ErrorMessage message={error} />}

                            {isLoading ? (
                                <LoadingSpinner />
                            ) : (
                                <div className='admin-table-wrapper'>
                                    <table className='admin-table'>
                                        <thead>
                                            <tr>
                                                <th>STT</th>
                                                <th>Tên đăng nhập</th>
                                                <th>Họ tên</th>
                                                <th>Email</th>
                                                <th>Đơn vị</th>
                                                <th>Vai trò</th>
                                                <th>Trạng thái</th>
                                                <th>Ngày tạo</th>
                                                <th>Hành động</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredUsers.length === 0 ? (
                                                <tr>
                                                    <td colSpan={9} className='admin-table-empty'>
                                                        Không có dữ liệu
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredUsers.map((user, index) => (
                                                    <tr key={user.UserID}>
                                                        <td>{index + 1}</td>
                                                        <td>{user.Username}</td>
                                                        <td>{user.FullName || '-'}</td>
                                                        <td>{user.Email || '-'}</td>
                                                        <td>{user.GroupName || '-'}</td>
                                                        <td>
                                                            <span className={`admin-badge ${user.Role === 'admin' ? 'admin-badge-admin' : 'admin-badge-user'}`}>
                                                                {user.Role === 'admin' ? 'Admin' : 'User'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className={`admin-badge ${user.IsActive ? 'admin-badge-active' : 'admin-badge-inactive'}`}>
                                                                {user.IsActive ? 'Hoạt động' : 'Vô hiệu'}
                                                            </span>
                                                        </td>
                                                        <td>{formatDateTime(user.CreatedDate)}</td>
                                                        <td>
                                                            <div className='admin-actions'>
                                                                <button className='admin-btn-edit' onClick={() => openEdit(user)}>
                                                                    Sửa
                                                                </button>
                                                                <button className='admin-btn-delete' onClick={() => openDelete(user)}>
                                                                    Xoá
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value='audit' className='flex flex-1 min-h-0 flex-col'>
                            <div className='admin-audit-toolbar'>
                                <label htmlFor='audit-date-picker'>Ngày log</label>
                                <input
                                    id='audit-date-picker'
                                    type='date'
                                    value={selectedAuditDate}
                                    min={minAuditDate}
                                    max={maxAuditDate}
                                    onChange={e => setSelectedAuditDate(e.target.value)}
                                />
                                <Button
                                    className='common-button-ghost'
                                    onClick={() => setSelectedAuditDate(todayAuditDate)}
                                    disabled={isAuditLoading}
                                >
                                    Hôm nay
                                </Button>
                                <Button
                                    className='common-button-ghost'
                                    onClick={() => setSelectedAuditDate('')}
                                    disabled={isAuditLoading || !selectedAuditDate}
                                >
                                    Tất cả ngày
                                </Button>
                                <span className='admin-audit-toolbar-meta'>
                                    {selectedAuditDate
                                        ? `Đang xem ngày ${selectedAuditDate}`
                                        : 'Đang xem log mới nhất qua nhiều ngày'}
                                </span>
                            </div>

                            <div className='admin-audit-searchbar'>
                                <SearchBar
                                    value={auditKeyword}
                                    onLiveSearch={(keyword) => setAuditKeyword(keyword)}
                                    placeholder='Tìm trong action, user, IP, chi tiết...'
                                />
                                <span className='admin-audit-searchbar-meta'>
                                    {`Hiển thị ${filteredAuditLogs.length} / ${auditLogs.length} logs`}
                                </span>
                            </div>

                            {auditError && <ErrorMessage message={auditError} />}

                            {isAuditLoading ? (
                                <LoadingSpinner />
                            ) : (
                                <div className='admin-table-wrapper admin-table-wrapper-audit'>
                                    <table className='admin-table'>
                                        <thead>
                                            <tr>
                                                <th>Thời gian</th>
                                                <th>Action</th>
                                                <th>User</th>
                                                <th>IP</th>
                                                <th>Chi tiết</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredAuditLogs.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className='admin-table-empty'>
                                                        Không có dữ liệu{auditMeta?.date ? ` (${auditMeta.date})` : ''}
                                                    </td>
                                                </tr>
                                            ) : (
                                                pagedAuditLogs.map((item, index) => {
                                                    const { timestamp, action, ip, username, adminUsername, userId, adminId, ...rest } = item || {}
                                                    const displayUser = adminUsername || username || (adminId != null ? `adminId:${adminId}` : '') || (userId != null ? `userId:${userId}` : '') || '-'
                                                    const displayIp = ip || '-'
                                                    const detailObj = Object.keys(rest || {}).length ? rest : null
                                                    const detailText = detailObj ? JSON.stringify(detailObj) : '-'

                                                    return (
                                                        <tr key={`${timestamp || 't'}-${(auditPage - 1) * auditPageSize + index}`}>
                                                            <td>{timestamp ? formatDateTime(timestamp) : '-'}</td>
                                                            <td>{action || '-'}</td>
                                                            <td>{displayUser}</td>
                                                            <td>{displayIp}</td>
                                                            <td className='admin-audit-detail-cell'>{detailText}</td>
                                                        </tr>
                                                    )
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {!isAuditLoading && auditLogs.length > 0 && (
                                <div className='admin-audit-pagination'>
                                    <Pagination
                                        page={auditPage}
                                        pageSize={auditPageSize}
                                        totalItems={filteredAuditLogs.length}
                                        onPageChange={setAuditPage}
                                        onPageSizeChange={(size) => {
                                            setAuditPageSize(size)
                                            setAuditPage(1)
                                        }}
                                        pageSizeOptions={AUDIT_PAGE_SIZE_OPTIONS}
                                    />
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Modal thêm / sửa tài khoản */}
            {modalMode && (
                <div className='admin-modal-overlay' onClick={closeModal}>
                    <div className='admin-modal' onClick={e => e.stopPropagation()}>
                        <h2 className='admin-modal-title'>
                            {modalMode === 'add' ? 'Thêm tài khoản' : 'Sửa tài khoản'}
                        </h2>

                        <div className='admin-form-group'>
                            {modalMode === 'add' && (
                                <div className='admin-field'>
                                    <label>Tên đăng nhập *</label>
                                    <input
                                        name='username'
                                        value={form.username}
                                        onChange={handleChangeForm}
                                        placeholder='Nhập tên đăng nhập'
                                        autoComplete='off'
                                    />
                                </div>
                            )}

                            <div className='admin-field'>
                                <label>Họ tên *</label>
                                <input
                                    name='fullName'
                                    value={form.fullName}
                                    onChange={handleChangeForm}
                                    placeholder='Nhập họ tên đầy đủ'
                                />
                            </div>

                            <div className='admin-field'>
                                <label>Email</label>
                                <input
                                    name='email'
                                    type='email'
                                    value={form.email}
                                    onChange={handleChangeForm}
                                    placeholder='Nhập email (tuỳ chọn)'
                                />
                            </div>

                            <div className='admin-field'>
                                <label>Vai trò</label>
                                <select name='role' value={form.role} onChange={handleChangeForm}>
                                    <option value='user'>User</option>
                                    <option value='admin'>Admin</option>
                                </select>
                            </div>

                                <div className='admin-field'>
                                <label>Đơn vị (phân quyền xem văn bản)</label>
                                <select name='groupId' value={form.groupId} onChange={handleChangeForm}>
                                    <option value=''>-- Không giới hạn (xem tất cả) --</option>
                                    {departments.map(dept => (
                                        <option key={dept.GroupID} value={String(dept.GroupID)}>
                                            {dept.GroupName}
                                        </option>
                                    ))}
                                </select>
                                <span className='admin-field-hint'>Admin luôn được xem tất cả bất kể thiết lập này</span>
                            </div>

                            {modalMode === 'edit' && (
                                <div className='admin-field'>
                                    <label>Trạng thái</label>
                                    <select name='isActive' value={form.isActive ? 'true' : 'false'} onChange={e => setForm(prev => ({ ...prev, isActive: e.target.value === 'true' }))}>
                                        <option value='true'>Hoạt động</option>
                                        <option value='false'>Vô hiệu hoá</option>
                                    </select>
                                </div>
                            )}

                            <div className='admin-field'>
                                <label>{modalMode === 'add' ? 'Mật khẩu *' : 'Mật khẩu mới'}</label>
                                <input
                                    name='password'
                                    type='password'
                                    value={form.password}
                                    onChange={handleChangeForm}
                                    placeholder={modalMode === 'add' ? 'Ít nhất 8 ký tự' : 'Để trống nếu không đổi'}
                                    autoComplete='new-password'
                                />
                                {modalMode === 'edit' && (
                                    <span className='admin-field-hint'>Để trống nếu không muốn thay đổi mật khẩu</span>
                                )}
                            </div>
                        </div>

                        {formError && <div className='admin-modal-error'>{formError}</div>}

                        <div className='admin-modal-actions'>
                            <Button className='common-button-ghost' onClick={closeModal} disabled={isSaving}>
                                Huỷ
                            </Button>
                            <Button onClick={handleSave} disabled={isSaving}>
                                {isSaving ? 'Đang lưu...' : 'Lưu'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm xoá */}
            {deleteTarget && (
                <div className='admin-modal-overlay' onClick={closeDelete}>
                    <div className='admin-modal' onClick={e => e.stopPropagation()}>
                        <h2 className='admin-modal-title'>Xác nhận xoá tài khoản</h2>
                        <p className='admin-confirm-body'>
                            Bạn có chắc muốn xoá tài khoản{' '}
                            <span className='admin-confirm-name'>{deleteTarget.Username}</span>?
                            Hành động này không thể hoàn tác.
                        </p>

                        {deleteError && <div className='admin-modal-error'>{deleteError}</div>}

                        <div className='admin-modal-actions'>
                            <Button className='common-button-ghost' onClick={closeDelete} disabled={isDeleting}>
                                Huỷ
                            </Button>
                            <button
                                className='admin-btn-delete'
                                style={{ padding: '8px 20px', fontSize: '0.875rem' }}
                                onClick={handleDelete}
                                disabled={isDeleting}>
                                {isDeleting ? 'Đang xoá...' : 'Xoá'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Toast toasts={toast.toasts} onRemove={toast.removeToast} />
        </div>
    )
}
