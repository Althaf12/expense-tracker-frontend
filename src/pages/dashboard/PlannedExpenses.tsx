import { Typography } from '@mui/material'
import type { ReactElement } from 'react'
import { ClipboardList, GripVertical, Check, RefreshCw } from 'lucide-react'
import type { UserExpense } from '../../types/app'
import styles from './Dashboard.shared.module.css'
import localStyles from './PlannedExpenses.module.css'
import Skeleton from '../../components/Skeleton'

type TemplateGroup = {
  categoryId: string
  categoryName: string
  expenses: UserExpense[]
}

type Props = {
  loading?: boolean
  groupedUserExpenses: TemplateGroup[]
  completedMonthlyTemplates: number
  visibleTemplates: UserExpense[]
  monthlyTemplateProgress: number
  templateSaving: Record<string, boolean>
  handleResetMonthlyStatus: () => Promise<void>
  handleCategoryDragStart: (categoryId: string) => void
  handleCategoryDragOver: (e: React.DragEvent<HTMLElement>) => void
  handleCategoryDrop: (e: React.DragEvent<HTMLElement>, targetId: string) => void
  handleCategoryDragEnd: () => void
  handleTemplateMarkPaid: (expense: UserExpense) => Promise<void>
  expenseTemplatesTotal: number
  formatCurrency: (n: number) => string
  userExpenses: UserExpense[]
}

export default function PlannedExpenses({
  groupedUserExpenses,
  completedMonthlyTemplates,
  visibleTemplates,
  monthlyTemplateProgress,
  templateSaving,
  handleResetMonthlyStatus,
  handleCategoryDragStart,
  handleCategoryDragOver,
  handleCategoryDrop,
  handleCategoryDragEnd,
  handleTemplateMarkPaid,
  expenseTemplatesTotal,
  formatCurrency,
  userExpenses,
  loading = false,
}: Props): ReactElement {
  if (loading) {
    return (
      <section className={styles.card} aria-live="polite">
        <header className={styles.cardHeader}>
          <div>
            <Typography variant="h5" component="h2" className={styles.cardTitle}>
              Planned Expenses
            </Typography>
            <Typography variant="body2" component="p" className={styles.cardSubtitle}>
                  Drag categories to prioritise and track their monthly status.
                </Typography>
          </div>
          <div className={styles.headerActions}>
            <span className={styles.cardBadge}>—</span>
          </div>
        </header>
        <div style={{ padding: '1rem' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 120 }}><Skeleton /></div>
              <div style={{ flex: 1 }}><Skeleton /></div>
            </div>
          ))}
        </div>
      </section>
    )
  }
  return (
    <section className={styles.card} aria-live="polite">
      <header className={styles.cardHeader}>
        <div className={localStyles.headerWithIcon}>
          <div className={localStyles.iconWrapper}>
            <ClipboardList size={22} />
          </div>
          <div>
            <Typography variant="h5" component="h2" className={styles.cardTitle}>
              Planned Expenses
            </Typography>
            <Typography variant="body2" component="p" className={styles.cardSubtitle}>
              Drag categories to prioritise and track their monthly status.
            </Typography>
          </div>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.cardBadge}>{completedMonthlyTemplates}/{visibleTemplates.length} completed</span>
          <button type="button" className={localStyles.resetButton} onClick={handleResetMonthlyStatus} disabled={visibleTemplates.length === 0}>
            <RefreshCw size={16} />
            Reset month
          </button>
        </div>
      </header>

      {visibleTemplates.length === 0 ? (
        <Typography variant="body2" component="p" className={styles.placeholder}>
          {userExpenses.length === 0
            ? 'No planned expenses yet. Add them in your profile to plan monthly spending.'
            : 'All planned expenses are inactive. Activate planned expenses in your profile to track them here.'}
        </Typography>
      ) : (
        <>
          <div className={localStyles.progressTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(monthlyTemplateProgress)}>
            <div className={localStyles.progressFill} style={{ width: `${monthlyTemplateProgress}%` }} />
          </div>
          <div className={localStyles.plannedTableContainer} role="group" aria-label="Planned expenses grouped by category">
            <div className={localStyles.gridHeader}>
              <div className={localStyles.gridHeaderCell}>Category</div>
              <div className={localStyles.gridHeaderCell}>Planned Expenses</div>
            </div>

            <div className={localStyles.gridBody}>
              {groupedUserExpenses.map((group) => {
                const groupTotal = group.expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0)
                return (
                  <div
                    key={group.categoryId}
                    className={localStyles.plannedRow}
                    draggable
                    onDragStart={() => handleCategoryDragStart(group.categoryId)}
                    onDragOver={handleCategoryDragOver}
                    onDrop={(event) => handleCategoryDrop(event, group.categoryId)}
                    onDragEnd={handleCategoryDragEnd}
                  >
                    <div className={localStyles.plannedCategoryCell}>
                      <span className={localStyles.dragHandle} aria-hidden="true">
                        <GripVertical size={18} />
                      </span>
                      <div className={localStyles.plannedCategoryMeta}>
                        <span className={localStyles.plannedCategoryName}>{group.categoryName}</span>
                        <span className={localStyles.plannedCategoryTotal}>{formatCurrency(groupTotal)}</span>
                      </div>
                    </div>

                    <div className={localStyles.plannedExpenseListCell}>
                      {group.expenses.length === 0 ? (
                        <span className={localStyles.plannedEmpty}>No planned expenses in this category.</span>
                      ) : (
                        <ul className={localStyles.plannedExpenseList}>
                          {group.expenses.map((expense) => {
                            const expenseId = String(expense.userExpensesId)
                            const checked = (expense.paid ?? 'N') === 'Y'
                            const saving = templateSaving[expenseId] === true
                            const statusLabel = saving ? 'Saving…' : checked ? 'Paid' : 'Mark paid'
                            return (
                              <li key={expenseId} className={localStyles.plannedExpenseItem}>
                                <div className={localStyles.plannedExpenseInfo}>
                                  <span className={localStyles.plannedExpenseName}>{expense.userExpenseName}</span>
                                  <span className={localStyles.plannedExpenseAmount}>{formatCurrency(Number(expense.amount ?? 0))}</span>
                                </div>
                                <label className={localStyles.plannedCheckboxLabel}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={checked || saving}
                                    onChange={() => handleTemplateMarkPaid(expense)}
                                    aria-label={`Mark ${expense.userExpenseName} as paid for this month`}
                                  />
                                  <span>{statusLabel}</span>
                                </label>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className={localStyles.plannedFooter}>
            <span className={localStyles.plannedFooterLabel}>Total planned</span>
            <span className={localStyles.plannedFooterAmount}>{formatCurrency(expenseTemplatesTotal)}</span>
          </div>
        </>
      )}
    </section>
  )
}
