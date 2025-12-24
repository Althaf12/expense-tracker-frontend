export type SessionData = {
  userId: string
  username?: string
  email?: string
  token?: string
  subscription?: {
    plan?: string
    status?: string
    expiresAt?: string
  }
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
  userId?: string
}

export type UserExpense = {
  userExpensesId: string | number
  userId: string
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

export type FontSize = 'S' | 'M' | 'L'
export type ThemeCode = 'L' | 'D'
export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'SGD' | 'AED' | 'JPY' | 'CNY'

export type UserPreferences = {
  userPreferencesId?: number
  userId: string
  fontSize: FontSize
  currencyCode: CurrencyCode
  theme: ThemeCode
  lastUpdateTmstp?: string
}

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  AED: 'د.إ',
  JPY: '¥',
  CNY: '¥',
}

export const CURRENCY_OPTIONS: { code: CurrencyCode; symbol: string; name: string }[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
]

export const FONT_SIZE_OPTIONS: { code: FontSize; label: string }[] = [
  { code: 'S', label: 'Small' },
  { code: 'M', label: 'Medium' },
  { code: 'L', label: 'Large' },
]

export type MonthlyBalance = {
  openingBalance?: number
  closingBalance?: number
  month?: number
  year?: number
}

/** Generic paginated API response type */
export type PagedResponse<T> = {
  content: T[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}
