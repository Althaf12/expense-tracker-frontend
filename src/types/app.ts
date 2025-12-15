export type SessionData = {
  username: string
  identifier?: string
  user?: Record<string, unknown>
  // other session properties may exist
}

export type StatusMessage = {
  type: 'loading' | 'error' | 'success' | 'info'
  message: string
}

export type Expense = {
  expensesId?: string | number
  expenseId?: string | number
  expenseName?: string
  description?: string
  /** @deprecated prefer userExpenseCategoryId; kept for backward compatibility */
  expenseCategoryId?: string | number
  userExpenseCategoryId?: string | number
  expenseCategoryName?: string
  amount?: number | string
  expenseAmount?: number | string
  expenseDate?: string
}

// Removed ExpenseCategory type; use UserExpenseCategory everywhere

export type UserExpenseCategory = {
  userExpenseCategoryId: string | number
  userExpenseCategoryName: string
  status: 'A' | 'I'
  lastUpdateTmstp?: string
  username?: string
}

export type UserExpense = {
  userExpensesId: string | number
  username: string
  userExpenseName: string
  userExpenseCategoryName: string
  userExpenseCategoryId?: string | number
  amount: number
  paid?: 'Y' | 'N'
  status: 'A' | 'I'
  lastUpdateTmstp?: string
}

export type Income = {
  incomeId?: string | number
  source?: string
  amount?: number | string
  receivedDate?: string
  month?: number | string
  year?: number
}

export type MonthlyBalance = {
  openingBalance?: number
  closingBalance?: number
  month?: number
  year?: number
}
