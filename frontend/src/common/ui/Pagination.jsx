import Button from './Button'

export default function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  disablePageSizeSelect = false,
  showPageSizeSelect = true,
}) {
  const safeTotalItems = Math.max(0, Number(totalItems) || 0)
  const safePageSize = Math.max(1, Number(pageSize) || 10)
  const totalPages = Math.max(1, Math.ceil(safeTotalItems / safePageSize))
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages)

  const start = safeTotalItems === 0 ? 0 : (currentPage - 1) * safePageSize + 1
  const end = Math.min(currentPage * safePageSize, safeTotalItems)

  return (
    <div className="common-pagination">
      <div className="common-pagination-info">
        Hiển thị {start}-{end} / {safeTotalItems}
      </div>

      <div className="common-pagination-controls">
        <Button type="button" disabled={currentPage <= 1} onClick={() => onPageChange?.(currentPage - 1)}>
          Trước
        </Button>

        <span className="common-pagination-page">
          Trang {currentPage}/{totalPages}
        </span>

        <Button type="button" disabled={currentPage >= totalPages} onClick={() => onPageChange?.(currentPage + 1)}>
          Sau
        </Button>

        {showPageSizeSelect ? (
          <select
            className="common-pagination-size"
            value={safePageSize}
            disabled={disablePageSizeSelect}
            onChange={(event) => onPageSizeChange?.(Number(event.target.value))}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option} / trang
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </div>
  )
}
