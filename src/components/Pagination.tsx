import { useMemo, type ReactElement } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './Pagination.module.css'

type PaginationProps = {
  currentPage: number
  totalPages: number
  totalElements: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
  showSizeSelector?: boolean
  loading?: boolean
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

export default function Pagination({
  currentPage,
  totalPages,
  totalElements,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  showSizeSelector = true,
  loading = false,
}: PaginationProps): ReactElement | null {
  // Don't render if there's no data
  if (totalElements === 0) {
    return null
  }

  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = []
    const maxVisible = 7

    if (totalPages <= maxVisible) {
      for (let i = 0; i < totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(0)

      if (currentPage > 2) {
        pages.push('ellipsis')
      }

      // Pages around current
      const start = Math.max(1, currentPage - 1)
      const end = Math.min(totalPages - 2, currentPage + 1)

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i)
        }
      }

      if (currentPage < totalPages - 3) {
        pages.push('ellipsis')
      }

      // Always show last page
      if (!pages.includes(totalPages - 1)) {
        pages.push(totalPages - 1)
      }
    }

    return pages
  }, [currentPage, totalPages])

  const startItem = totalElements === 0 ? 0 : currentPage * pageSize + 1
  const endItem = Math.min((currentPage + 1) * pageSize, totalElements)

  const handlePrevious = () => {
    if (currentPage > 0 && !loading) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNext = () => {
    if (currentPage < totalPages - 1 && !loading) {
      onPageChange(currentPage + 1)
    }
  }

  const handlePageClick = (page: number) => {
    if (page !== currentPage && !loading) {
      onPageChange(page)
    }
  }

  const handleSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = Number(event.target.value)
    if (onPageSizeChange) {
      onPageSizeChange(newSize)
    }
  }

  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <span className={styles.summary}>
        Showing {startItem}–{endItem} of {totalElements}
      </span>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.navButton}
          onClick={handlePrevious}
          disabled={currentPage === 0 || loading}
          aria-label="Previous page"
        >
          <ChevronLeft size={18} />
        </button>

        {pageNumbers.map((page, index) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className={styles.ellipsis}>
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              className={`${styles.pageButton} ${page === currentPage ? styles.active : ''}`}
              onClick={() => handlePageClick(page)}
              disabled={loading}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page + 1}
            </button>
          ),
        )}

        <button
          type="button"
          className={styles.navButton}
          onClick={handleNext}
          disabled={currentPage >= totalPages - 1 || loading}
          aria-label="Next page"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {showSizeSelector && onPageSizeChange && (
        <div className={styles.sizeSelector}>
          <label htmlFor="page-size">Per page:</label>
          <select
            id="page-size"
            value={pageSize}
            onChange={handleSizeChange}
            disabled={loading}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      )}
    </nav>
  )
}
