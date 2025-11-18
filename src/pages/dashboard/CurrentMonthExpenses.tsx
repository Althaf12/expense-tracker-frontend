import { Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import type { ReactElement } from 'react'
import type { Expense } from '../../types/app'
import styles from './Dashboard.shared.module.css'
import localStyles from './CurrentMonthExpenses.module.css'

type Props = {
  label: string
  monthlyExpenses: Expense[]
  filteredMonthlyExpenses: Expense[]
  loading: boolean
  expenseTableFilters: { name: string; amount: string; date: string }
  handleExpenseFilterChange: (field: 'name' | 'amount' | 'date', value: string) => void
  clearExpenseFilters: () => void
  expenseFiltersApplied: boolean
  formatAmount: (value: number) => string
  monthlyTotal: number
}

export default function CurrentMonthExpenses({
  label,
  monthlyExpenses,
  filteredMonthlyExpenses,
  loading,
  expenseTableFilters,
  handleExpenseFilterChange,
  clearExpenseFilters,
  expenseFiltersApplied,
  formatAmount,
  monthlyTotal,
}: Props): ReactElement {
  const formatToDDMMYYYY = (value: unknown): string => {
    if (value === undefined || value === null) return ''
    // Attempt to create a Date. If value is already a Date or a parsable string/number, this will work.
    const d = new Date(String(value))
    if (!Number.isFinite(d.getTime())) return String(value)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}-${mm}-${yyyy}`
  }
  return (
    <section className={styles.card} aria-busy={loading}>
      <header className={styles.cardHeader}>
        <div>
          <Typography variant="h5" component="h2" className={styles.cardTitle}>
            Current Month Expenses
          </Typography>
          <Typography variant="body2" component="p" className={styles.cardSubtitle}>
            {label}
          </Typography>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.cardBadge}>{filteredMonthlyExpenses.length} items</span>
          <Link to="/operations/expenses" className={styles.addButton} aria-label="Add expense">
            Add Expense
          </Link>
        </div>
      </header>
      {loading && monthlyExpenses.length === 0 ? (
        <Typography variant="body2" component="p" className={localStyles.placeholder}>
          Loading data…
        </Typography>
      ) : monthlyExpenses.length === 0 ? (
        <Typography variant="body2" component="p" className={localStyles.placeholder}>
          No expenses recorded this month.
        </Typography>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Expense</th>
                <th scope="col" className={styles.numeric}>Amount</th>
                <th scope="col">Date</th>
              </tr>
              <tr className={styles.tableFilterRow}>
                <th scope="col">
                  <input
                    className={styles.tableFilterInput}
                    type="search"
                    placeholder="Filter expense"
                    value={expenseTableFilters.name}
                    onChange={(event) => handleExpenseFilterChange('name', event.target.value)}
                  />
                </th>
                <th scope="col">
                  <input
                    className={styles.tableFilterInput}
                    type="search"
                    placeholder="Filter amount"
                    value={expenseTableFilters.amount}
                    onChange={(event) => handleExpenseFilterChange('amount', event.target.value)}
                  />
                </th>
                <th scope="col">
                  <div className={styles.filterControls}>
                    <input
                      className={styles.tableFilterInput}
                      type="search"
                      placeholder="Filter date"
                      value={expenseTableFilters.date}
                      onChange={(event) => handleExpenseFilterChange('date', event.target.value)}
                    />
                    {expenseFiltersApplied && (
                      <button type="button" className={styles.clearButton} onClick={clearExpenseFilters}>
                        Clear
                      </button>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredMonthlyExpenses.length === 0 ? (
                <tr className={styles.emptyRow}>
                  <td colSpan={3}>No expenses match the current filters.</td>
                </tr>
              ) : (
                filteredMonthlyExpenses.map((expense) => {
                  const key = String(
                    expense.expenseId ??
                      expense.expensesId ??
                      expense.expenseName ??
                      expense.description ??
                      expense.expenseDate,
                  )
                  return (
                    <tr key={key}>
                      <td>{expense.expenseName ?? expense.description ?? '-'}</td>
                      <td className={styles.numeric}>{formatAmount(Number(expense.amount ?? expense.expenseAmount))}</td>
                      <td>{expense.expenseDate ? formatToDDMMYYYY(expense.expenseDate) : ''}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className={styles.numeric}>
                  <span className={styles.totalPill}>{formatAmount(monthlyTotal)}</span>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}
