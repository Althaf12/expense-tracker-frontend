export type SessionData = {
  userId: string
  username?: string
  email?: string
  profileImageUrl?: string
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
  /** Net expense after adjustments (original - completed adjustments) */
  netExpenseAmount?: number
  /** Sum of all completed adjustments for this expense */
  totalAdjustments?: number
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
export type IncomeMonth = 'P' | 'C'
export type ShowHideInfo = 'S' | 'H'

export type UserPreferences = {
  userPreferencesId?: number
  userId: string
  fontSize: FontSize
  currencyCode: CurrencyCode
  theme: ThemeCode
  incomeMonth: IncomeMonth
  showHideInfo: ShowHideInfo
  lastUpdateTmstp?: string
}

export const INCOME_MONTH_OPTIONS: { code: IncomeMonth; label: string; description: string }[] = [
  { code: 'P', label: 'Previous Month', description: 'Use last month\'s income (recommended for salary)' },
  { code: 'C', label: 'Current Month', description: 'Use this month\'s income' },
]

export const SHOW_HIDE_INFO_OPTIONS: { code: ShowHideInfo; label: string; description: string }[] = [
  { code: 'S', label: 'Show', description: 'Show all amounts normally' },
  { code: 'H', label: 'Hide', description: 'Hide amounts with XXX...' },
]

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
  id?: number
  userId?: string
  openingBalance?: number
  closingBalance?: number
  month?: number
  year?: number
  createdTmstp?: string
}

export type MonthlyBalanceUpdateRequest = {
  userId: string
  year: number
  month: number
  openingBalance?: number
  closingBalance?: number
}

export type MonthlyBalanceUpdateResponse = {
  status: string
  data: MonthlyBalance
}

/** Generic paginated API response type */
export type PagedResponse<T> = {
  content: T[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

// ============================================================================
// Export/Report Types
// ============================================================================

export type ExportType = 'EXPENSES' | 'INCOME' | 'BOTH'
export type ExportFormat = 'EXCEL' | 'PDF'

export type ExportRequest = {
  userId: string
  startDate: string
  endDate: string
  exportType?: ExportType
  format?: ExportFormat
}

export type EmailExportRequest = ExportRequest & {
  email: string
}

export type EmailExportResponse = {
  success: boolean
  message: string
  fileName: string | null
  totalRecords: number
}

// ============================================================================
// Analytics Types
// ============================================================================

export type AnalyticsExpenseRecord = {
  expensesId: number
  userId: string
  expenseName: string
  expenseAmount: number
  userExpenseCategoryName: string
  lastUpdateTmstp: string
  expenseDate: string
}

export type AnalyticsIncomeRecord = {
  incomeId: number
  userId: string
  source: string
  amount: number
  receivedDate: string
  month: number
  year: number
}

export type AnalyticsDataResponse<T> = {
  data: T[]
  totalRecords: number
  maxRecordsLimit: number
}

export type AnalyticsSummary = {
  totalExpenses: number
  totalIncome: number
  netBalance: number
  /** Sum of all completed adjustments in the date range */
  totalAdjustments?: number
  /** totalExpenses - totalAdjustments */
  netExpenses?: number
  totalExpenseCount: number
  totalIncomeCount: number
  expensesByCategory: Record<string, number>
  incomesBySource: Record<string, number>
  monthlyExpenseTrend: Record<string, number>
  monthlyIncomeTrend: Record<string, number>
}

// ============================================================================
// Expense Adjustment Types
// ============================================================================

export type AdjustmentType = 'REFUND' | 'CASHBACK' | 'REVERSAL'
export type AdjustmentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export const ADJUSTMENT_TYPES: { value: AdjustmentType; label: string }[] = [
  { value: 'REFUND', label: 'Refund' },
  { value: 'CASHBACK', label: 'Cashback' },
  { value: 'REVERSAL', label: 'Reversal' },
]

export const ADJUSTMENT_STATUSES: { value: AdjustmentStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export const ALLOWED_ADJUSTMENT_PAGE_SIZES = [10, 20, 50, 100] as const

export type ExpenseAdjustment = {
  expenseAdjustmentsId: number
  expensesId: number
  userId: string
  adjustmentType: AdjustmentType
  adjustmentAmount: number
  adjustmentReason?: string | null
  adjustmentDate: string
  status: AdjustmentStatus
  createdAt?: string
  lastUpdateTmstp?: string
  expenseName?: string | null
  originalExpenseAmount?: number | null
}

export type ExpenseAdjustmentRequest = {
  expenseAdjustmentsId?: number
  expensesId: number | string
  userId: string
  adjustmentType: AdjustmentType
  adjustmentAmount: number
  adjustmentReason?: string
  adjustmentDate: string
  status?: AdjustmentStatus
}

export type ExpenseAdjustmentDateRangeRequest = {
  userId: string
  startDate: string
  endDate: string
}

export type TotalAdjustmentResponse = {
  totalAdjustment: number
}

export type AllowedPageSizesResponse = {
  allowedPageSizes: number[]
}
