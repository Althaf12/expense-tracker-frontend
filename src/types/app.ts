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
  expenseCategoryId?: string | number
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

export type Income = {
  incomeId?: string | number
  source?: string
  amount?: number | string
  receivedDate?: string
  month?: number | string
  year?: number
}
