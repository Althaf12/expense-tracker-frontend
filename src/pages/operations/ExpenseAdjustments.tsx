import { useCallback, useEffect, useMemo, useState, type ReactElement, type FormEvent } from 'react'
import {
  RefreshCcw,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Search,
  Calendar,
  DollarSign,
  AlertCircle,
} from 'lucide-react'
import {
  fetchExpenseAdjustmentsByUser,
  fetchExpenseAdjustmentsByExpense,
  fetchExpenseAdjustmentsByDateRange,
  createExpenseAdjustment,
  updateExpenseAdjustment,
  deleteExpenseAdjustment,
  fetchTotalAdjustmentForMonth,
} from '../../api'
import type {
  ExpenseAdjustment,
  ExpenseAdjustmentRequest,
  AdjustmentType,
  AdjustmentStatus,
  PagedResponse,
} from '../../types/app'
import {
  ADJUSTMENT_TYPES,
  ADJUSTMENT_STATUSES,
  ALLOWED_ADJUSTMENT_PAGE_SIZES,
} from '../../types/app'
import { useAppDataContext } from '../../context/AppDataContext'
import { friendlyErrorMessage } from '../../utils/format'
import { usePreferences } from '../../context/PreferencesContext'
import { guestStore } from '../../utils/guestStore'
import styles from './ExpenseAdjustments.module.css'
import Skeleton from '../../components/Skeleton'
import Pagination from '../../components/Pagination'

const DEFAULT_PAGE_SIZE = 20

type FormMode = 'create' | 'edit' | null

type AdjustmentFormData = {
  expenseAdjustmentsId?: number
  expensesId: string
  expenseName?: string
  originalExpenseAmount?: number
  adjustmentType: AdjustmentType
  adjustmentAmount: string
  adjustmentReason: string
  adjustmentDate: string
  status: AdjustmentStatus
}

const emptyForm: AdjustmentFormData = {
  expensesId: '',
  adjustmentType: 'REFUND',
  adjustmentAmount: '',
  adjustmentReason: '',
  adjustmentDate: new Date().toISOString().split('T')[0],
  status: 'COMPLETED',
}

const validateAmount = (amount: string): string[] => {
  const errors: string[] = []
  if (!amount.trim()) {
    errors.push('Amount is required')
    return errors
  }
  const numAmount = parseFloat(amount)
  if (isNaN(numAmount)) {
    errors.push('Amount must be a valid number')
    return errors
  }
  if (numAmount <= 0) {
    errors.push('Amount must be greater than zero')
  }
  const decimalPart = amount.split('.')[1]
  if (decimalPart && decimalPart.length > 2) {
    errors.push('Amount can have at most 2 decimal places')
  }
  if (numAmount > 99999999.99) {
    errors.push('Amount exceeds maximum allowed value')
  }
  return errors
}

const validateDate = (date: string): string[] => {
  const errors: string[] = []
  if (!date) {
    errors.push('Date is required')
    return errors
  }
  const dateObj = new Date(date)
  const year = dateObj.getFullYear()
  if (year < 2000 || year > 2100) {
    errors.push('Date must be between year 2000 and 2100')
  }
  return errors
}

const getStatusBadgeClass = (status: AdjustmentStatus): string => {
  switch (status) {
    case 'COMPLETED': return styles.statusCompleted
    case 'PENDING': return styles.statusPending
    case 'FAILED': return styles.statusFailed
    case 'CANCELLED': return styles.statusCancelled
    default: return ''
  }
}

const getTypeBadgeClass = (type: AdjustmentType): string => {
  switch (type) {
    case 'REFUND': return styles.typeRefund
    case 'CASHBACK': return styles.typeCashback
    case 'REVERSAL': return styles.typeReversal
    default: return ''
  }
}

export default function ExpenseAdjustments(): ReactElement {
  const { session, setStatus } = useAppDataContext()
  const { formatCurrency } = usePreferences()

  const [adjustments, setAdjustments] = useState<ExpenseAdjustment[]>([])
  const [loading, setLoading] = useState(false)
  const [actionInFlight, setActionInFlight] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  // Form state
  const [formMode, setFormMode] = useState<FormMode>(null)
  const [formData, setFormData] = useState<AdjustmentFormData>(emptyForm)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Expanded rows for viewing adjustments inline
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  // Date range filter
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [isFiltering, setIsFiltering] = useState(false)

  // Monthly totals
  const [monthlyTotal, setMonthlyTotal] = useState<number>(0)

  const userId = session?.userId ?? ''
  const isGuest = guestStore.isGuestUser(userId)

  const loadAdjustments = useCallback(
    async (page: number, size: number) => {
      if (!userId) {
        setAdjustments([])
        return
      }
      setLoading(true)
      try {
        let response: PagedResponse<ExpenseAdjustment>
        if (isFiltering && filterStartDate && filterEndDate) {
          response = await fetchExpenseAdjustmentsByDateRange(
            { userId, startDate: filterStartDate, endDate: filterEndDate },
            page,
            size
          )
        } else {
          response = await fetchExpenseAdjustmentsByUser(userId, page, size)
        }
        setAdjustments(response.content ?? [])
        setTotalPages(response.totalPages ?? 0)
        setTotalElements(response.totalElements ?? 0)
        setCurrentPage(page)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStatus({ type: 'error', message: friendlyErrorMessage(message, 'loading adjustments') })
      } finally {
        setLoading(false)
      }
    },
    [userId, setStatus, isFiltering, filterStartDate, filterEndDate]
  )

  const loadMonthlyTotal = useCallback(async () => {
    if (!userId) return
    const now = new Date()
    try {
      const total = await fetchTotalAdjustmentForMonth(userId, now.getFullYear(), now.getMonth() + 1)
      setMonthlyTotal(total)
    } catch {
      // Ignore errors for monthly total
    }
  }, [userId])

  useEffect(() => {
    void loadAdjustments(0, pageSize)
    void loadMonthlyTotal()
  }, [loadAdjustments, loadMonthlyTotal, pageSize])

  const handlePageChange = (page: number) => {
    void loadAdjustments(page, pageSize)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    void loadAdjustments(0, size)
  }

  const handleFilter = () => {
    if (!filterStartDate || !filterEndDate) {
      setStatus({ type: 'error', message: 'Please select both start and end dates' })
      return
    }
    setIsFiltering(true)
    void loadAdjustments(0, pageSize)
  }

  const handleClearFilter = () => {
    setFilterStartDate('')
    setFilterEndDate('')
    setIsFiltering(false)
    void loadAdjustments(0, pageSize)
  }

  const openCreateForm = () => {
    setFormMode('create')
    setFormData(emptyForm)
    setFormErrors({})
  }

  const openEditForm = (adjustment: ExpenseAdjustment) => {
    setFormMode('edit')
    setFormData({
      expenseAdjustmentsId: adjustment.expenseAdjustmentsId,
      expensesId: String(adjustment.expensesId),
      expenseName: adjustment.expenseName ?? undefined,      originalExpenseAmount: adjustment.originalExpenseAmount ?? undefined,      adjustmentType: adjustment.adjustmentType,
      adjustmentAmount: String(adjustment.adjustmentAmount),
      adjustmentReason: adjustment.adjustmentReason ?? '',
      adjustmentDate: adjustment.adjustmentDate,
      status: adjustment.status,
    })
    setFormErrors({})
  }

  const closeForm = () => {
    setFormMode(null)
    setFormData(emptyForm)
    setFormErrors({})
  }

  const validateForm = async (): Promise<boolean> => {
    const errors: Record<string, string> = {}

    if (!formData.expensesId.trim()) {
      errors.expensesId = 'Expense ID is required'
    }

    const amountErrors = validateAmount(formData.adjustmentAmount)
    if (amountErrors.length > 0) {
      errors.adjustmentAmount = amountErrors[0]
    }

    const dateErrors = validateDate(formData.adjustmentDate)
    if (dateErrors.length > 0) {
      errors.adjustmentDate = dateErrors[0]
    }

    // Validate adjustment amount against expense amount
    if (!errors.adjustmentAmount && formData.originalExpenseAmount != null) {
      const newAmount = parseFloat(formData.adjustmentAmount)
      const expenseAmount = formData.originalExpenseAmount
      
      // Get existing adjustments for this expense to calculate total
      try {
        const existingAdjustments = await fetchExpenseAdjustmentsByExpense(userId, formData.expensesId)
        
        // Calculate total of other adjustments (exclude current if editing)
        const otherAdjustmentsTotal = existingAdjustments
          .filter(adj => formMode === 'edit' ? adj.expenseAdjustmentsId !== formData.expenseAdjustmentsId : true)
          .reduce((sum, adj) => sum + adj.adjustmentAmount, 0)
        
        const totalAfterAdjustment = otherAdjustmentsTotal + newAmount
        
        if (newAmount > expenseAmount) {
          errors.adjustmentAmount = `Amount cannot exceed expense amount (${formatCurrency(expenseAmount)})`
        } else if (totalAfterAdjustment > expenseAmount) {
          const remainingAllowed = expenseAmount - otherAdjustmentsTotal
          errors.adjustmentAmount = `Total adjustments would exceed expense amount. Maximum allowed: ${formatCurrency(Math.max(0, remainingAllowed))}`
        }
      } catch (error) {
        // If we can't fetch existing adjustments, just validate against expense amount
        if (newAmount > expenseAmount) {
          errors.adjustmentAmount = `Amount cannot exceed expense amount (${formatCurrency(expenseAmount)})`
        }
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const isValid = await validateForm()
    if (!isValid) return

    setActionInFlight(true)
    const actionLabel = formMode === 'create' ? 'Creating' : 'Updating'
    setStatus({ type: 'loading', message: `${actionLabel} adjustment…` })

    try {
      const payload: ExpenseAdjustmentRequest = {
        expensesId: parseInt(formData.expensesId, 10),
        userId,
        adjustmentType: formData.adjustmentType,
        adjustmentAmount: parseFloat(parseFloat(formData.adjustmentAmount).toFixed(2)),
        adjustmentReason: formData.adjustmentReason || undefined,
        adjustmentDate: formData.adjustmentDate,
        status: formData.status,
      }

      if (formMode === 'edit' && formData.expenseAdjustmentsId) {
        payload.expenseAdjustmentsId = formData.expenseAdjustmentsId
        await updateExpenseAdjustment(payload)
        setStatus({ type: 'success', message: 'Adjustment updated successfully' })
      } else {
        await createExpenseAdjustment(payload)
        setStatus({ type: 'success', message: 'Adjustment created successfully' })
      }

      closeForm()
      await loadAdjustments(currentPage, pageSize)
      await loadMonthlyTotal()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // Check if it's a backend validation error and display it appropriately
      if (message.toLowerCase().includes('amount') || message.toLowerCase().includes('exceed') || message.toLowerCase().includes('adjustment')) {
        setFormErrors({ adjustmentAmount: message })
        setStatus({ type: 'error', message })
      } else {
        setStatus({ type: 'error', message: friendlyErrorMessage(message, `${actionLabel.toLowerCase()} adjustment`) })
      }
    } finally {
      setActionInFlight(false)
    }
  }

  const handleDelete = async (adjustment: ExpenseAdjustment) => {
    if (!confirm(`Delete this ${adjustment.adjustmentType.toLowerCase()} of ${formatCurrency(adjustment.adjustmentAmount)}?`)) {
      return
    }

    setActionInFlight(true)
    setStatus({ type: 'loading', message: 'Deleting adjustment…' })

    try {
      await deleteExpenseAdjustment(userId, adjustment.expenseAdjustmentsId)
      setStatus({ type: 'success', message: 'Adjustment deleted successfully' })
      await loadAdjustments(currentPage, pageSize)
      await loadMonthlyTotal()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'deleting adjustment') })
    } finally {
      setActionInFlight(false)
    }
  }

  const toggleRowExpand = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const adjustmentsWithSerial = useMemo(
    () => adjustments.map((a, i) => ({ ...a, serial: currentPage * pageSize + i + 1 })),
    [adjustments, currentPage, pageSize]
  )

  return (
    <div className={styles.pageContainer}>
      <header className={styles.pageHeader}>
        <div className={styles.headerContent}>
          <span className={styles.headerEmoji}>🔄</span>
          <div className={styles.headerText}>
            <h1 className={styles.pageTitle}>Expense Adjustments</h1>
            <p className={styles.pageSubtitle}>
              Manage refunds, cashbacks, and reversals for your expenses
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.monthlyTotal}>
            <span className={styles.monthlyTotalLabel}>This Month:</span>
            <span className={styles.monthlyTotalValue}>{formatCurrency(monthlyTotal)}</span>
          </div>
        </div>
      </header>

      {/* Date Range Filter */}
      <section className={styles.filterSection}>
        <div className={styles.filterRow}>
          <div className={styles.filterField}>
            <label htmlFor="filter-start">Start Date</label>
            <input
              id="filter-start"
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className={styles.dateInput}
            />
          </div>
          <div className={styles.filterField}>
            <label htmlFor="filter-end">End Date</label>
            <input
              id="filter-end"
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className={styles.dateInput}
            />
          </div>
          <div className={styles.filterActions}>
            <button
              type="button"
              className={styles.filterButton}
              onClick={handleFilter}
              disabled={loading}
            >
              <Search size={16} />
              <span>Filter</span>
            </button>
            {isFiltering && (
              <button
                type="button"
                className={styles.clearFilterButton}
                onClick={handleClearFilter}
                disabled={loading}
              >
                <X size={16} />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Create/Edit Form */}
      {formMode && (
        <section className={styles.formSection}>
          <h2 className={styles.formTitle}>
            {formMode === 'create' ? 'Create New Adjustment' : 'Edit Adjustment'}
          </h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="expensesId">Expense {formMode === 'edit' ? '' : '*'}</label>
                {formMode === 'edit' ? (
                  <input
                    id="expensesId"
                    type="text"
                    value={formData.expenseName || `Expense #${formData.expensesId}`}
                    disabled
                    className={styles.disabledInput}
                  />
                ) : (
                  <>
                    <input
                      id="expensesId"
                      type="number"
                      value={formData.expensesId}
                      onChange={(e) => setFormData((prev) => ({ ...prev, expensesId: e.target.value }))}
                      disabled={actionInFlight}
                      className={formErrors.expensesId ? styles.inputError : ''}
                      placeholder="Enter expense ID"
                    />
                    {formErrors.expensesId && <span className={styles.errorText}>{formErrors.expensesId}</span>}
                  </>
                )}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="adjustmentType">Type *</label>
                <select
                  id="adjustmentType"
                  value={formData.adjustmentType}
                  onChange={(e) => setFormData((prev) => ({ ...prev, adjustmentType: e.target.value as AdjustmentType }))}
                  disabled={actionInFlight}
                >
                  {ADJUSTMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="adjustmentAmount">Amount *</label>
                <input
                  id="adjustmentAmount"
                  type="text"
                  inputMode="decimal"
                  value={formData.adjustmentAmount}
                  onChange={(e) => {
                    const val = e.target.value
                    if (/^\d*\.?\d{0,2}$/.test(val) || val === '') {
                      setFormData((prev) => ({ ...prev, adjustmentAmount: val }))
                    }
                  }}
                  disabled={actionInFlight}
                  className={formErrors.adjustmentAmount ? styles.inputError : ''}
                  placeholder="0.00"
                />
                {formErrors.adjustmentAmount && <span className={styles.errorText}>{formErrors.adjustmentAmount}</span>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="adjustmentDate">Date *</label>
                <input
                  id="adjustmentDate"
                  type="date"
                  value={formData.adjustmentDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, adjustmentDate: e.target.value }))}
                  disabled={actionInFlight}
                  className={formErrors.adjustmentDate ? styles.inputError : ''}
                />
                {formErrors.adjustmentDate && <span className={styles.errorText}>{formErrors.adjustmentDate}</span>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as AdjustmentStatus }))}
                  disabled={actionInFlight}
                >
                  {ADJUSTMENT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className={`${styles.formGroup} ${styles.formGroupWide}`}>
                <label htmlFor="adjustmentReason">Reason</label>
                <input
                  id="adjustmentReason"
                  type="text"
                  value={formData.adjustmentReason}
                  onChange={(e) => setFormData((prev) => ({ ...prev, adjustmentReason: e.target.value }))}
                  disabled={actionInFlight}
                  placeholder="Optional reason for the adjustment"
                />
              </div>
            </div>

            <div className={styles.formActions}>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={actionInFlight}
              >
                <Check size={16} />
                <span>{formMode === 'create' ? 'Create' : 'Update'}</span>
              </button>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={closeForm}
                disabled={actionInFlight}
              >
                <X size={16} />
                <span>Cancel</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Adjustments Table */}
      <section className={styles.tableContainer}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.expandCol}></th>
                <th className={styles.serialCol}>#</th>
                <th className={styles.dateCol}>
                  <Calendar size={14} />
                  <span>Date</span>
                </th>
                <th className={styles.typeCol}>Type</th>
                <th className={styles.amountCol}>
                  <DollarSign size={14} />
                  <span>Amount</span>
                </th>
                <th className={styles.expenseCol}>Expense</th>
                <th className={styles.statusCol}>Status</th>
                <th className={styles.reasonCol}>Reason</th>
                <th className={styles.actionsCol}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`}>
                    <td><div style={{ width: '1.5rem' }}><Skeleton /></div></td>
                    <td><div style={{ width: '1.5rem' }}><Skeleton /></div></td>
                    <td><div style={{ width: '5rem' }}><Skeleton /></div></td>
                    <td><div style={{ width: '4rem' }}><Skeleton /></div></td>
                    <td><div style={{ width: '4rem' }}><Skeleton /></div></td>
                    <td><div style={{ width: '6rem' }}><Skeleton /></div></td>
                    <td><div style={{ width: '4rem' }}><Skeleton /></div></td>
                    <td><div style={{ width: '6rem' }}><Skeleton /></div></td>
                    <td><div style={{ width: '4rem' }}><Skeleton /></div></td>
                  </tr>
                ))
              ) : adjustmentsWithSerial.length === 0 ? (
                <tr>
                  <td colSpan={9} className={styles.emptyRow}>
                    <div className={styles.emptyState}>
                      <AlertCircle size={32} />
                      <p>No expense adjustments found.</p>
                      <button type="button" className={styles.addButton} onClick={openCreateForm}>
                        <Plus size={16} />
                        <span>Add your first adjustment</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                adjustmentsWithSerial.map((adjustment) => {
                  const isExpanded = expandedRows.has(adjustment.expenseAdjustmentsId)
                  return (
                    <>
                      <tr key={adjustment.expenseAdjustmentsId} className={isExpanded ? styles.expandedRow : ''}>
                        <td className={styles.expandCell}>
                          <button
                            type="button"
                            className={styles.expandButton}
                            onClick={() => toggleRowExpand(adjustment.expenseAdjustmentsId)}
                            title={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                        <td className={styles.serialCell}>{adjustment.serial}</td>
                        <td className={styles.dateCell}>{adjustment.adjustmentDate}</td>
                        <td className={styles.typeCell}>
                          <span className={`${styles.typeBadge} ${getTypeBadgeClass(adjustment.adjustmentType)}`}>
                            {adjustment.adjustmentType}
                          </span>
                        </td>
                        <td className={styles.amountCell}>{formatCurrency(adjustment.adjustmentAmount)}</td>
                        <td className={styles.expenseCell}>
                          <div className={styles.expenseInfo}>
                            <span className={styles.expenseName}>{adjustment.expenseName ?? `#${adjustment.expensesId}`}</span>
                            {adjustment.originalExpenseAmount != null && (
                              <span className={styles.originalAmount}>
                                Original: {formatCurrency(adjustment.originalExpenseAmount)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={styles.statusCell}>
                          <span className={`${styles.statusBadge} ${getStatusBadgeClass(adjustment.status)}`}>
                            {adjustment.status}
                          </span>
                        </td>
                        <td className={styles.reasonCell}>
                          <span className={styles.reasonText} title={adjustment.adjustmentReason ?? ''}>
                            {adjustment.adjustmentReason || '-'}
                          </span>
                        </td>
                        <td className={styles.actionsCell}>
                          <div className={styles.actionButtons}>
                            <button
                              type="button"
                              className={styles.editButton}
                              onClick={() => openEditForm(adjustment)}
                              disabled={actionInFlight || formMode !== null}
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className={styles.deleteButton}
                              onClick={() => handleDelete(adjustment)}
                              disabled={actionInFlight}
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${adjustment.expenseAdjustmentsId}-detail`} className={styles.detailRow}>
                          <td colSpan={9}>
                            <div className={styles.detailContent}>
                              <div className={styles.detailGrid}>
                                <div className={styles.detailItem}>
                                  <span className={styles.detailLabel}>Adjustment ID</span>
                                  <span className={styles.detailValue}>{adjustment.expenseAdjustmentsId}</span>
                                </div>
                                <div className={styles.detailItem}>
                                  <span className={styles.detailLabel}>Expense</span>
                                  <span className={styles.detailValue}>{adjustment.expenseName ?? '-'}</span>
                                </div>
                                <div className={styles.detailItem}>
                                  <span className={styles.detailLabel}>Created At</span>
                                  <span className={styles.detailValue}>
                                    {adjustment.createdAt ? new Date(adjustment.createdAt).toLocaleString() : '-'}
                                  </span>
                                </div>
                                <div className={styles.detailItem}>
                                  <span className={styles.detailLabel}>Last Updated</span>
                                  <span className={styles.detailValue}>
                                    {adjustment.lastUpdateTmstp ? new Date(adjustment.lastUpdateTmstp).toLocaleString() : '-'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalElements={totalElements}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={[...ALLOWED_ADJUSTMENT_PAGE_SIZES]}
          showSizeSelector
          loading={loading}
        />
      </section>
    </div>
  )
}
