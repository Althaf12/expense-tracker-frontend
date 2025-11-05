export type Expense = {
  expensesId?: string | number
  expenseName?: string
  expenseAmount?: number
  expenseDate?: string
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
