export type Expense = {
  expenseId?: string | number
  expensesId?: string | number
  username?: string
  expenseCategoryId?: string | number
  expenseName?: string
  description?: string
  expenseAmount?: number
  amount?: number
  expenseDate?: string
  lastUpdateTmstp?: string
  [key: string]: unknown
}

export type ExpenseCategory = {
  expenseCategoryId: string | number
  expenseCategoryName: string
  lastUpdateTmstp?: string | null
}

export type Income = {
  incomeId?: string | number
  username?: string
  source?: string
  amount?: number
  receivedDate?: string
  lastUpdateTmstp?: string
  month?: string | number
  year?: number
  [key: string]: unknown
}

export type SessionData = {
  username: string
  identifier?: string
  user?: Record<string, unknown>
}

export type StatusMessage = {
  type: 'loading' | 'error' | 'success'
  message: string
}
