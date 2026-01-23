import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import {
  Pencil,
  Check,
  X,
  Calendar,
  Wallet,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import { fetchAllMonthlyBalances, updateMonthlyBalance } from '../../api'
import type { MonthlyBalance as MonthlyBalanceType, PagedResponse } from '../../types/app'
import { useAppDataContext } from '../../context/AppDataContext'
import { friendlyErrorMessage } from '../../utils/format'
import { usePreferences } from '../../context/PreferencesContext'
import styles from './MonthlyBalance.module.css'
import Skeleton from '../../components/Skeleton'
import Pagination from '../../components/Pagination'

const DEFAULT_PAGE_SIZE = 20

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

type EditDraft = {
  openingBalance: string
  closingBalance: string
}

const parseAmount = (input: string): number | null => {
  const trimmed = input.trim()
  if (!trimmed) return null
  const numeric = Number(trimmed)
  if (!Number.isFinite(numeric)) return null
  return numeric
}

const ensureBalanceId = (balance: MonthlyBalanceType): string =>
  String(balance.id ?? `${balance.month}-${balance.year}`)

export default function MonthlyBalance(): ReactElement {
  const { session, setStatus } = useAppDataContext()
  const { formatCurrency } = usePreferences()

  const [balances, setBalances] = useState<MonthlyBalanceType[]>([])
  const [loading, setLoading] = useState(false)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [actionInFlight, setActionInFlight] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  const userId = session?.userId ?? ''

  const loadBalances = useCallback(
    async (page: number, size: number) => {
      if (!userId) {
        setBalances([])
        return
      }
      setLoading(true)
      try {
        const response: PagedResponse<MonthlyBalanceType> = await fetchAllMonthlyBalances({
          userId,
          page,
          size,
        })
        setBalances(response.content ?? [])
        setTotalPages(response.totalPages ?? 0)
        setTotalElements(response.totalElements ?? 0)
        setCurrentPage(page)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStatus({ type: 'error', message: friendlyErrorMessage(message, 'loading monthly balances') })
      } finally {
        setLoading(false)
      }
    },
    [userId, setStatus]
  )

  useEffect(() => {
    void loadBalances(0, pageSize)
  }, [loadBalances, pageSize])

  const handlePageChange = (page: number) => {
    void loadBalances(page, pageSize)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    void loadBalances(0, size)
  }

  const beginEdit = (balance: MonthlyBalanceType) => {
    setEditingRowId(ensureBalanceId(balance))
    setEditDraft({
      openingBalance: balance.openingBalance?.toString() ?? '',
      closingBalance: balance.closingBalance?.toString() ?? '',
    })
  }

  const cancelEdit = () => {
    setEditingRowId(null)
    setEditDraft(null)
  }

  const saveEdit = async (balance: MonthlyBalanceType) => {
    if (!editDraft || !userId) return

    const openingBalance = parseAmount(editDraft.openingBalance)
    const closingBalance = parseAmount(editDraft.closingBalance)

    if (openingBalance === null || closingBalance === null) {
      setStatus({ type: 'error', message: 'Please enter valid numbers for both balances.' })
      return
    }

    setActionInFlight(true)
    setStatus({ type: 'loading', message: 'Updating balance…' })

    try {
      if (typeof balance.month !== 'number' || typeof balance.year !== 'number') {
        setStatus({ type: 'error', message: 'Month and year are required to update monthly balance.' })
        setActionInFlight(false)
        return
      }
      await updateMonthlyBalance({
        userId,
        month: balance.month,
        year: balance.year,
        openingBalance,
        closingBalance,
      })
      setStatus({ type: 'success', message: 'Monthly balance updated successfully.' })
      cancelEdit()
      await loadBalances(currentPage, pageSize)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'updating monthly balance') })
    } finally {
      setActionInFlight(false)
    }
  }

  const balancesWithSerial = useMemo(
    () => balances.map((b, i) => ({ ...b, serial: currentPage * pageSize + i + 1 })),
    [balances, currentPage, pageSize]
  )

  const getNetChangeIcon = (opening: number | undefined, closing: number | undefined) => {
    if (opening === undefined || closing === undefined) return <Minus size={14} />
    const diff = (closing ?? 0) - (opening ?? 0)
    if (diff > 0) return <TrendingUp size={14} className={styles.positive} />
    if (diff < 0) return <TrendingDown size={14} className={styles.negative} />
    return <Minus size={14} />
  }

  const getNetChange = (opening: number | undefined, closing: number | undefined) => {
    if (opening === undefined || closing === undefined) return '-'
    const diff = (closing ?? 0) - (opening ?? 0)
    const prefix = diff >= 0 ? '+' : ''
    return prefix + formatCurrency(diff)
  }

  const getNetChangeClass = (opening: number | undefined, closing: number | undefined) => {
    if (opening === undefined || closing === undefined) return ''
    const diff = (closing ?? 0) - (opening ?? 0)
    if (diff > 0) return styles.positive
    if (diff < 0) return styles.negative
    return ''
  }

  return (
    <div className={styles.pageContainer}>
      <header className={styles.pageHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerIcon}>
            <Wallet size={24} />
          </div>
          <div className={styles.headerText}>
            <h1 className={styles.pageTitle}>Monthly Balance</h1>
            <p className={styles.pageSubtitle}>
              View and manage your monthly opening and closing balances
            </p>
          </div>
        </div>
        <p className={styles.noteBox}>
          <strong>Note:</strong> Monthly balances are calculated at the end of every month. This keeps your balance consistent at the start of new month.
        </p>
      </header>

      <section className={styles.tableContainer}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.serialCol}>#</th>
                <th className={styles.monthCol}>
                  <Calendar size={14} />
                  <span>Month</span>
                </th>
                <th className={styles.yearCol}>Year</th>
                <th className={styles.amountCol}>Opening Balance</th>
                <th className={styles.amountCol}>Closing Balance</th>
                <th className={styles.changeCol}>Net Change</th>
                <th className={styles.actionsCol}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`}>
                    <td><div style={{ width: '1.5rem' }}><Skeleton /></div></td>
                    <td><div style={{ width: '6rem' }}><Skeleton /></div></td>
                    <td><div style={{ width: '3rem' }}><Skeleton /></div></td>
                    <td><div style={{ width: '5rem' }}><Skeleton /></div></td>
                    <td><div style={{ width: '5rem' }}><Skeleton /></div></td>
                    <td><div style={{ width: '4rem' }}><Skeleton /></div></td>
                    <td><div style={{ width: '3rem' }}><Skeleton /></div></td>
                  </tr>
                ))
              ) : balancesWithSerial.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyRow}>
                    No monthly balances found.
                  </td>
                </tr>
              ) : (
                balancesWithSerial.map((balance) => {
                  const rowId = ensureBalanceId(balance)
                  const isEditing = editingRowId === rowId

                  return (
                    <tr key={rowId} className={isEditing ? styles.editingRow : ''}>
                      <td className={styles.serialCell}>{balance.serial}</td>
                      <td className={styles.monthCell}>
                        {typeof balance.month === 'number' ? (MONTHS[balance.month - 1] ?? String(balance.month)) : String(balance.month ?? '-')}
                      </td>
                      <td className={styles.yearCell}>{balance.year}</td>
                      <td className={styles.amountCell}>
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            className={styles.editInput}
                            value={editDraft?.openingBalance ?? ''}
                            onChange={(e) =>
                              setEditDraft((prev) => prev ? { ...prev, openingBalance: e.target.value } : null)
                            }
                            disabled={actionInFlight}
                          />
                        ) : (
                          formatCurrency(balance.openingBalance ?? 0)
                        )}
                      </td>
                      <td className={styles.amountCell}>
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            className={styles.editInput}
                            value={editDraft?.closingBalance ?? ''}
                            onChange={(e) =>
                              setEditDraft((prev) => prev ? { ...prev, closingBalance: e.target.value } : null)
                            }
                            disabled={actionInFlight}
                          />
                        ) : (
                          formatCurrency(balance.closingBalance ?? 0)
                        )}
                      </td>
                      <td className={`${styles.changeCell} ${getNetChangeClass(balance.openingBalance, balance.closingBalance)}`}>
                        {getNetChangeIcon(balance.openingBalance, balance.closingBalance)}
                        <span>{getNetChange(balance.openingBalance, balance.closingBalance)}</span>
                      </td>
                      <td className={styles.actionsCell}>
                        {isEditing ? (
                          <div className={styles.editActions}>
                            <button
                              type="button"
                              className={styles.saveButton}
                              onClick={() => void saveEdit(balance)}
                              disabled={actionInFlight}
                              title="Save"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              type="button"
                              className={styles.cancelButton}
                              onClick={cancelEdit}
                              disabled={actionInFlight}
                              title="Cancel"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={styles.editButton}
                            onClick={() => beginEdit(balance)}
                            disabled={actionInFlight || editingRowId !== null}
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
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
          pageSizeOptions={[10, 20, 50, 100]}
          showSizeSelector
          loading={loading}
        />
      </section>
    </div>
  )
}
