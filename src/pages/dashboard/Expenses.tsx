import type { Expense } from '../../types/app'
import type { ReactElement } from 'react'
import { formatAmount, formatDate } from '../../utils/format'
import styles from './Expenses.module.css'

type ExpensesProps = {
  expenses?: Expense[]
}

export default function Expenses({ expenses = [] }: ExpensesProps): ReactElement {
  const items = Array.isArray(expenses) ? expenses : []

  return (
    <section className={styles.wrapper}>
      <header className={styles.header}>
        <h2 className={styles.title}>My Expenses</h2>
        <p className={styles.caption}>{items.length} recorded item{items.length === 1 ? '' : 's'}</p>
      </header>

      {items.length === 0 ? (
        <p className={styles.empty}>No expenses found.</p>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Expense</th>
                <th scope="col" className={styles.numeric}>Amount</th>
                <th scope="col">Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((expense, index) => {
                const key = String(expense.expensesId ?? `${expense.expenseDate ?? 'unknown'}-${expense.expenseName ?? index}`)
                return (
                  <tr key={key}>
                    <td>{expense.expenseName ?? '-'}</td>
                    <td className={styles.numeric}>{formatAmount(expense.expenseAmount)}</td>
                    <td>{formatDate(expense.expenseDate)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
