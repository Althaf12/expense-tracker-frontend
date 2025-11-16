import { Typography } from '@mui/material'
import type { ReactElement } from 'react'
import type { UserExpense } from '../../types/app'
import styles from './Dashboard.shared.module.css'
import localStyles from './ExpenseTemplates.module.css'

type TemplateGroup = {
  categoryId: string
  categoryName: string
  expenses: UserExpense[]
}

type Props = {
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
  formatAmount: (n: number) => string
  userExpenses: UserExpense[]
}

export default function ExpenseTemplates({
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
  formatAmount,
  userExpenses,
}: Props): ReactElement {
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
          <span className={styles.cardBadge}>{completedMonthlyTemplates}/{visibleTemplates.length} completed</span>
          <button type="button" className={styles.secondaryButton} onClick={handleResetMonthlyStatus} disabled={visibleTemplates.length === 0}>
            Reset month
          </button>
        </div>
      </header>

      {visibleTemplates.length === 0 ? (
        <Typography variant="body2" component="p" className={styles.placeholder}>
          {userExpenses.length === 0
            ? 'No expense templates yet. Add them in your profile to plan monthly spending.'
            : 'All expense templates are inactive. Activate templates in your profile to track them here.'}
        </Typography>
      ) : (
        <>
          <div className={localStyles.progressTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(monthlyTemplateProgress)}>
            <div className={localStyles.progressFill} style={{ width: `${monthlyTemplateProgress}%` }} />
          </div>
          <div className={localStyles.templateTableContainer} role="group" aria-label="Planned expenses grouped by category">
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
                    className={localStyles.templateRow}
                    draggable
                    onDragStart={() => handleCategoryDragStart(group.categoryId)}
                    onDragOver={handleCategoryDragOver}
                    onDrop={(event) => handleCategoryDrop(event, group.categoryId)}
                    onDragEnd={handleCategoryDragEnd}
                  >
                    <div className={localStyles.templateCategoryCell}>
                      <span className={localStyles.dragHandle} aria-hidden="true">⋮⋮</span>
                      <div className={localStyles.templateCategoryMeta}>
                        <span className={localStyles.templateCategoryName}>{group.categoryName}</span>
                        <span className={localStyles.templateCategoryTotal}>{formatAmount(groupTotal)}</span>
                      </div>
                    </div>

                    <div className={localStyles.templateExpenseListCell}>
                      {group.expenses.length === 0 ? (
                        <span className={localStyles.templateEmpty}>No templates in this category.</span>
                      ) : (
                        <ul className={localStyles.templateExpenseList}>
                          {group.expenses.map((expense) => {
                            const expenseId = String(expense.userExpensesId)
                            const checked = (expense.paid ?? 'N') === 'Y'
                            const saving = templateSaving[expenseId] === true
                            const statusLabel = saving ? 'Saving…' : checked ? 'Paid' : 'Mark paid'
                            return (
                              <li key={expenseId} className={localStyles.templateExpenseItem}>
                                <div className={localStyles.templateExpenseInfo}>
                                  <span className={localStyles.templateExpenseName}>{expense.userExpenseName}</span>
                                  <span className={localStyles.templateExpenseAmount}>{formatAmount(Number(expense.amount ?? 0))}</span>
                                </div>
                                <label className={localStyles.templateCheckboxLabel}>
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
          <div className={localStyles.templateFooter}>
            <span className={localStyles.templateFooterLabel}>Total planned</span>
            <span className={localStyles.templateFooterAmount}>{formatAmount(expenseTemplatesTotal)}</span>
          </div>
        </>
      )}
    </section>
  )
}
