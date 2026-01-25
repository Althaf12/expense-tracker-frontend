/**
 * Guest Store - In-memory data store for guest/demo users
 * Data is stored in sessionStorage and disappears when the browser is closed
 */

import type {
  Expense,
  Income,
  UserExpense,
  UserExpenseCategory,
  UserPreferences,
  MonthlyBalance,
  PagedResponse,
  ExpenseAdjustment,
  AdjustmentType,
  AdjustmentStatus,
} from '../types/app'

const GUEST_USER_ID = 'guest-user'
const GUEST_USERNAME = 'Guest User'
const STORAGE_KEY = 'guest-store-data'
// Bump this number when default/demo data changes to force reinitialization
const GUEST_STORE_VERSION = 3

// Default demo data for guest users
const DEFAULT_CATEGORIES: UserExpenseCategory[] = [
  { userExpenseCategoryId: 'cat-1', userExpenseCategoryName: 'Food & Dining', status: 'A', userId: GUEST_USER_ID },
  { userExpenseCategoryId: 'cat-2', userExpenseCategoryName: 'Transportation', status: 'A', userId: GUEST_USER_ID },
  { userExpenseCategoryId: 'cat-3', userExpenseCategoryName: 'Shopping', status: 'A', userId: GUEST_USER_ID },
  { userExpenseCategoryId: 'cat-4', userExpenseCategoryName: 'Entertainment', status: 'A', userId: GUEST_USER_ID },
  { userExpenseCategoryId: 'cat-5', userExpenseCategoryName: 'Utilities', status: 'A', userId: GUEST_USER_ID },
  { userExpenseCategoryId: 'cat-6', userExpenseCategoryName: 'Healthcare', status: 'A', userId: GUEST_USER_ID },
  { userExpenseCategoryId: 'cat-7', userExpenseCategoryName: 'Education', status: 'I', userId: GUEST_USER_ID },
  { userExpenseCategoryId: 'cat-8', userExpenseCategoryName: 'Travel', status: 'I', userId: GUEST_USER_ID },
]

const DEFAULT_USER_EXPENSES: UserExpense[] = [
  { userExpensesId: 'exp-1', userId: GUEST_USER_ID, userExpenseName: 'Rent', userExpenseCategoryName: 'Utilities', userExpenseCategoryId: 'cat-5', amount: 15000, status: 'A', paid: 'N' },
  { userExpensesId: 'exp-2', userId: GUEST_USER_ID, userExpenseName: 'Groceries', userExpenseCategoryName: 'Food & Dining', userExpenseCategoryId: 'cat-1', amount: 5000, status: 'A', paid: 'N' },
  { userExpensesId: 'exp-3', userId: GUEST_USER_ID, userExpenseName: 'Internet', userExpenseCategoryName: 'Utilities', userExpenseCategoryId: 'cat-5', amount: 1000, status: 'A', paid: 'N' },
  { userExpensesId: 'exp-4', userId: GUEST_USER_ID, userExpenseName: 'Fuel', userExpenseCategoryName: 'Transportation', userExpenseCategoryId: 'cat-2', amount: 3000, status: 'A', paid: 'N' },
  { userExpensesId: 'exp-5', userId: GUEST_USER_ID, userExpenseName: 'Gym Membership', userExpenseCategoryName: 'Healthcare', userExpenseCategoryId: 'cat-6', amount: 1500, status: 'I', paid: 'N' },
]

const DEFAULT_PREFERENCES: UserPreferences = {
  userId: GUEST_USER_ID,
  fontSize: 'S',
  currencyCode: 'INR',
  theme: 'L',
  incomeMonth: 'P',
  showHideInfo: 'S',
}

// Generate sample expenses for current month
function generateSampleExpenses(): Expense[] {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  
  const expenses: Expense[] = []
  const samples = [
    { name: 'Coffee & Snacks', categoryId: 'cat-1', categoryName: 'Food & Dining', amount: 250 },
    { name: 'Lunch', categoryId: 'cat-1', categoryName: 'Food & Dining', amount: 450 },
    { name: 'Bus Fare', categoryId: 'cat-2', categoryName: 'Transportation', amount: 100 },
    { name: 'Movie Tickets', categoryId: 'cat-4', categoryName: 'Entertainment', amount: 600 },
    { name: 'Online Shopping', categoryId: 'cat-3', categoryName: 'Shopping', amount: 1200 },
    { name: 'Electricity Bill', categoryId: 'cat-5', categoryName: 'Utilities', amount: 2500 },
    { name: 'Medicine', categoryId: 'cat-6', categoryName: 'Healthcare', amount: 350 },
  ]
  
  // Generate expenses for last 10 days
  for (let i = 0; i < 10; i++) {
    const date = new Date(year, month, Math.max(1, now.getDate() - i))
    const sample = samples[i % samples.length]
    expenses.push({
      expensesId: `guest-exp-${i + 1}`,
      expenseId: `guest-exp-${i + 1}`,
      expenseName: sample.name,
      userExpenseCategoryId: sample.categoryId,
      expenseCategoryName: sample.categoryName,
      amount: sample.amount + Math.floor(Math.random() * 100),
      expenseDate: date.toISOString().split('T')[0],
    })
  }
  
  return expenses
}

// Format date as YYYY-MM-DD in local timezone (avoids UTC shift from toISOString)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Generate sample incomes dynamically based on current date.
// Previous month = one month before current, Older month = two months before current.
// This ensures dashboard always shows correct previous-month income without future changes.
function generateSampleIncomes(): Income[] {
  const now = new Date()

  // previousMonthDate -> first day of previous month
  const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  // olderMonthDate -> first day of month before previous
  const olderMonthDate = new Date(now.getFullYear(), now.getMonth() - 2, 1)

  const prevMonth = previousMonthDate.getMonth() + 1
  const prevYear = previousMonthDate.getFullYear()
  const olderMonth = olderMonthDate.getMonth() + 1
  const olderYear = olderMonthDate.getFullYear()

  return [
    // Older month (two months before current) - not shown as "previous" in dashboard
    {
      incomeId: generateId('inc'),
      source: 'Salary',
      amount: 45000,
      receivedDate: formatLocalDate(olderMonthDate),
      month: olderMonth,
      year: olderYear,
    },
    // Previous month (one month before current) - used by dashboard for Total Income
    {
      incomeId: generateId('inc'),
      source: 'Salary',
      amount: 50000,
      receivedDate: formatLocalDate(previousMonthDate),
      month: prevMonth,
      year: prevYear,
    },
    {
      incomeId: generateId('inc'),
      source: 'Freelance',
      amount: 12000,
      // Mid-month for variety
      receivedDate: formatLocalDate(new Date(prevYear, prevMonth - 1, 15)),
      month: prevMonth,
      year: prevYear,
    },
  ]
}

// Generate sample adjustments for demo purposes
function generateSampleAdjustments(expenses: Expense[]): ExpenseAdjustment[] {
  const now = new Date()
  const adjustments: ExpenseAdjustment[] = []
  
  // Add a refund for "Online Shopping" expense if it exists
  const shoppingExpense = expenses.find(e => e.expenseName === 'Online Shopping')
  if (shoppingExpense) {
    const expenseId = shoppingExpense.expensesId ?? shoppingExpense.expenseId
    adjustments.push({
      expenseAdjustmentsId: 1,
      expensesId: expenseId as unknown as number, // Keep as string for matching
      userId: GUEST_USER_ID,
      adjustmentType: 'REFUND',
      adjustmentAmount: 200,
      adjustmentReason: 'Item returned - wrong size',
      adjustmentDate: formatLocalDate(new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - 2))),
      status: 'COMPLETED',
      expenseName: shoppingExpense.expenseName,
      originalExpenseAmount: Number(shoppingExpense.amount ?? shoppingExpense.expenseAmount),
    })
    // Update expense with adjustment info
    shoppingExpense.totalAdjustments = 200
    shoppingExpense.netExpenseAmount = Number(shoppingExpense.amount ?? shoppingExpense.expenseAmount) - 200
  }
  
  // Add a cashback for "Movie Tickets" expense
  const movieExpense = expenses.find(e => e.expenseName === 'Movie Tickets')
  if (movieExpense) {
    const expenseId = movieExpense.expensesId ?? movieExpense.expenseId
    adjustments.push({
      expenseAdjustmentsId: 2,
      expensesId: expenseId as unknown as number,
      userId: GUEST_USER_ID,
      adjustmentType: 'CASHBACK',
      adjustmentAmount: 50,
      adjustmentReason: 'Credit card cashback',
      adjustmentDate: formatLocalDate(new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - 3))),
      status: 'COMPLETED',
      expenseName: movieExpense.expenseName,
      originalExpenseAmount: Number(movieExpense.amount ?? movieExpense.expenseAmount),
    })
    // Update expense with adjustment info
    movieExpense.totalAdjustments = 50
    movieExpense.netExpenseAmount = Number(movieExpense.amount ?? movieExpense.expenseAmount) - 50
  }
  
  // Add a pending refund for "Electricity Bill"
  const electricityExpense = expenses.find(e => e.expenseName === 'Electricity Bill')
  if (electricityExpense) {
    const expenseId = electricityExpense.expensesId ?? electricityExpense.expenseId
    adjustments.push({
      expenseAdjustmentsId: 3,
      expensesId: expenseId as unknown as number,
      userId: GUEST_USER_ID,
      adjustmentType: 'REFUND',
      adjustmentAmount: 150,
      adjustmentReason: 'Meter reading correction - overcharge refund',
      adjustmentDate: formatLocalDate(new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - 1))),
      status: 'PENDING',
      expenseName: electricityExpense.expenseName,
      originalExpenseAmount: Number(electricityExpense.amount ?? electricityExpense.expenseAmount),
    })
    // Update expense with adjustment info (even pending adjustments count)
    electricityExpense.totalAdjustments = 150
    electricityExpense.netExpenseAmount = Number(electricityExpense.amount ?? electricityExpense.expenseAmount) - 150
  }
  
  return adjustments
}

interface GuestStoreData {
  categories: UserExpenseCategory[]
  userExpenses: UserExpense[]
  expenses: Expense[]
  incomes: Income[]
  adjustments: ExpenseAdjustment[]
  preferences: UserPreferences
  initialized: boolean
  version?: number
}

// In-memory store (also backed by sessionStorage)
let storeData: GuestStoreData | null = null

function loadFromSession(): GuestStoreData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch {
    /* ignore */
  }
  return null
}

function saveToSession(data: GuestStoreData): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

function getStore(): GuestStoreData {
  if (storeData) return storeData
  
  const fromSession = loadFromSession()
  // If stored data exists and matches current version, reuse it.
  // Otherwise reinitialize so generated incomes (previous/older months) stay current.
  if (fromSession && fromSession.initialized && fromSession.version === GUEST_STORE_VERSION) {
    storeData = fromSession
    return storeData
  }
  
  // Initialize with default data
  const expenses = generateSampleExpenses()
  const adjustments = generateSampleAdjustments(expenses)
  
  storeData = {
    categories: [...DEFAULT_CATEGORIES],
    userExpenses: [...DEFAULT_USER_EXPENSES],
    expenses,
    incomes: generateSampleIncomes(),
    adjustments,
    preferences: { ...DEFAULT_PREFERENCES },
    initialized: true,
    version: GUEST_STORE_VERSION,
  }
  saveToSession(storeData)
  return storeData
}

function updateStore(updates: Partial<GuestStoreData>): void {
  const store = getStore()
  Object.assign(store, updates)
  saveToSession(store)
}

// Generate unique ID
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// ============================================================================
// Guest Store Public API
// ============================================================================

export const guestStore = {
  GUEST_USER_ID,
  GUEST_USERNAME,

  isGuestUser(userId: string | undefined | null): boolean {
    return userId === GUEST_USER_ID
  },

  // Categories
  getCategories(): UserExpenseCategory[] {
    return [...getStore().categories]
  },

  getActiveCategories(): UserExpenseCategory[] {
    return getStore().categories.filter((c) => c.status === 'A')
  },

  createCategory(name: string, status: 'A' | 'I' = 'A'): UserExpenseCategory {
    const store = getStore()
    const newCategory: UserExpenseCategory = {
      userExpenseCategoryId: generateId('cat'),
      userExpenseCategoryName: name,
      status,
      userId: GUEST_USER_ID,
      lastUpdateTmstp: new Date().toISOString(),
    }
    store.categories.push(newCategory)
    updateStore({ categories: store.categories })
    return newCategory
  },

  updateCategory(id: string | number, name: string, status: 'A' | 'I'): void {
    const store = getStore()
    const cat = store.categories.find((c) => String(c.userExpenseCategoryId) === String(id))
    if (cat) {
      cat.userExpenseCategoryName = name
      cat.status = status
      cat.lastUpdateTmstp = new Date().toISOString()
      updateStore({ categories: store.categories })
    }
  },

  deleteCategory(id: string | number): { success: boolean; error?: string } {
    const store = getStore()
    const categoryId = String(id)
    
    // Check if category is used by any planned expenses (user expenses)
    const usedByPlanned = store.userExpenses.some(
      (e) => String(e.userExpenseCategoryId) === categoryId
    )
    if (usedByPlanned) {
      return { success: false, error: 'Cannot delete category: it is used by one or more planned expenses' }
    }
    
    // Check if category is used by any expenses
    const usedByExpenses = store.expenses.some(
      (e) => String(e.userExpenseCategoryId) === categoryId
    )
    if (usedByExpenses) {
      return { success: false, error: 'Cannot delete category: it is used by one or more expenses' }
    }
    
    store.categories = store.categories.filter((c) => String(c.userExpenseCategoryId) !== categoryId)
    updateStore({ categories: store.categories })
    return { success: true }
  },

  resetCategoriesToDefault(): void {
    updateStore({ categories: [...DEFAULT_CATEGORIES] })
  },

  // User Expenses (Planned Expenses)
  getUserExpenses(): UserExpense[] {
    return [...getStore().userExpenses]
  },

  getActiveUserExpenses(): UserExpense[] {
    return getStore().userExpenses.filter((e) => e.status === 'A')
  },

  createUserExpense(payload: {
    userExpenseName: string
    userExpenseCategoryId: string | number
    amount: number
    status?: 'A' | 'I'
    paid?: 'Y' | 'N'
  }): UserExpense {
    const store = getStore()
    const category = store.categories.find(
      (c) => String(c.userExpenseCategoryId) === String(payload.userExpenseCategoryId)
    )
    const newExpense: UserExpense = {
      userExpensesId: generateId('uexp'),
      userId: GUEST_USER_ID,
      userExpenseName: payload.userExpenseName,
      userExpenseCategoryName: category?.userExpenseCategoryName ?? '',
      userExpenseCategoryId: payload.userExpenseCategoryId,
      amount: payload.amount,
      status: payload.status ?? 'A',
      paid: payload.paid ?? 'N',
      lastUpdateTmstp: new Date().toISOString(),
    }
    store.userExpenses.push(newExpense)
    updateStore({ userExpenses: store.userExpenses })
    return newExpense
  },

  updateUserExpense(id: string | number, updates: Partial<UserExpense>): void {
    const store = getStore()
    const expense = store.userExpenses.find((e) => String(e.userExpensesId) === String(id))
    if (expense) {
      // Only apply non-undefined values to preserve existing data
      const cleanUpdates: Partial<UserExpense> = {}
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          (cleanUpdates as Record<string, unknown>)[key] = value
        }
      }
      Object.assign(expense, cleanUpdates, { lastUpdateTmstp: new Date().toISOString() })
      // Update category name if category changed
      if (cleanUpdates.userExpenseCategoryId) {
        const category = store.categories.find(
          (c) => String(c.userExpenseCategoryId) === String(cleanUpdates.userExpenseCategoryId)
        )
        if (category) {
          expense.userExpenseCategoryName = category.userExpenseCategoryName
        }
      }
      updateStore({ userExpenses: store.userExpenses })
    }
  },

  deleteUserExpense(id: string | number): void {
    const store = getStore()
    store.userExpenses = store.userExpenses.filter((e) => String(e.userExpensesId) !== String(id))
    updateStore({ userExpenses: store.userExpenses })
  },

  resetUserExpensesToDefault(): void {
    updateStore({ userExpenses: [...DEFAULT_USER_EXPENSES] })
  },

  // Reset all user expenses paid status to 'N' (for Reset Month)
  resetAllUserExpensesPaidStatus(): void {
    const store = getStore()
    store.userExpenses.forEach((expense) => {
      expense.paid = 'N'
      expense.lastUpdateTmstp = new Date().toISOString()
    })
    updateStore({ userExpenses: store.userExpenses })
  },

  // Expenses
  getExpenses(): Expense[] {
    return [...getStore().expenses]
  },

  getExpensesByMonth(month: number, year: number): PagedResponse<Expense> {
    const expenses = getStore().expenses.filter((e) => {
      if (!e.expenseDate) return false
      const date = new Date(e.expenseDate)
      return date.getMonth() + 1 === month && date.getFullYear() === year
    })
    return {
      content: expenses,
      totalElements: expenses.length,
      totalPages: 1,
      page: 0,
      size: expenses.length,
    }
  },

  getExpensesByRange(start: string, end: string): PagedResponse<Expense> {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const expenses = getStore().expenses.filter((e) => {
      if (!e.expenseDate) return false
      const date = new Date(e.expenseDate)
      return date >= startDate && date <= endDate
    })
    return {
      content: expenses,
      totalElements: expenses.length,
      totalPages: 1,
      page: 0,
      size: expenses.length,
    }
  },

  addExpense(payload: {
    userExpenseCategoryId: number | string
    expenseAmount: number
    expenseDate: string
    expenseName?: string
  }): Expense {
    const store = getStore()
    const category = store.categories.find(
      (c) => String(c.userExpenseCategoryId) === String(payload.userExpenseCategoryId)
    )
    const newExpense: Expense = {
      expensesId: generateId('exp'),
      expenseId: generateId('exp'),
      expenseName: payload.expenseName ?? '',
      userExpenseCategoryId: payload.userExpenseCategoryId,
      expenseCategoryName: category?.userExpenseCategoryName ?? '',
      amount: payload.expenseAmount,
      expenseAmount: payload.expenseAmount,
      expenseDate: payload.expenseDate,
    }
    store.expenses.push(newExpense)
    updateStore({ expenses: store.expenses })
    return newExpense
  },

  updateExpense(id: string | number, updates: Partial<Expense>): void {
    const store = getStore()
    const expense = store.expenses.find(
      (e) => String(e.expensesId) === String(id) || String(e.expenseId) === String(id)
    )
    if (expense) {
      // Only apply non-undefined values to preserve existing data
      const cleanUpdates: Partial<Expense> = {}
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          (cleanUpdates as Record<string, unknown>)[key] = value
        }
      }
      Object.assign(expense, cleanUpdates)
      // Update category name if category changed
      if (cleanUpdates.userExpenseCategoryId) {
        const category = store.categories.find(
          (c) => String(c.userExpenseCategoryId) === String(cleanUpdates.userExpenseCategoryId)
        )
        if (category) {
          expense.expenseCategoryName = category.userExpenseCategoryName
        }
      }
      updateStore({ expenses: store.expenses })
    }
  },

  deleteExpense(id: string | number): void {
    const store = getStore()
    store.expenses = store.expenses.filter(
      (e) => String(e.expensesId) !== String(id) && String(e.expenseId) !== String(id)
    )
    updateStore({ expenses: store.expenses })
  },

  // Incomes
  getIncomes(): Income[] {
    return [...getStore().incomes]
  },

  getIncomesByMonth(month: number, year: number): PagedResponse<Income> {
    const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
    const incomes = getStore().incomes.filter((i) => {
      // Handle both numeric and string month values
      let incomeMonth: number
      if (typeof i.month === 'number') {
        incomeMonth = i.month
      } else if (typeof i.month === 'string') {
        const idx = MONTH_NAMES.indexOf(i.month.toLowerCase().trim())
        incomeMonth = idx >= 0 ? idx + 1 : -1
      } else {
        return false
      }
      return incomeMonth === month && i.year === year
    })
    return {
      content: incomes,
      totalElements: incomes.length,
      totalPages: 1,
      page: 0,
      size: incomes.length,
    }
  },

  getIncomesByRange(fromMonth: number, fromYear: number, toMonth: number, toYear: number): PagedResponse<Income> {
    const incomes = getStore().incomes.filter((i) => {
      if (!i.year || !i.month) return false
      const incomeDate = i.year * 12 + Number(i.month)
      const startDate = fromYear * 12 + fromMonth
      const endDate = toYear * 12 + toMonth
      return incomeDate >= startDate && incomeDate <= endDate
    })
    return {
      content: incomes,
      totalElements: incomes.length,
      totalPages: 1,
      page: 0,
      size: incomes.length,
    }
  },

  addIncome(payload: {
    source: string
    amount: number
    receivedDate: string
    month?: string | number
    year?: number
  }): Income {
    const store = getStore()
    const date = new Date(payload.receivedDate)
    
    // Convert month name to number if needed
    const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
    let monthNum: number
    if (payload.month === undefined || payload.month === null) {
      monthNum = date.getMonth() + 1
    } else if (typeof payload.month === 'number') {
      monthNum = payload.month
    } else {
      const idx = MONTH_NAMES.indexOf(String(payload.month).toLowerCase().trim())
      monthNum = idx >= 0 ? idx + 1 : date.getMonth() + 1
    }
    
    const newIncome: Income = {
      incomeId: generateId('inc'),
      source: payload.source,
      amount: payload.amount,
      receivedDate: payload.receivedDate,
      month: monthNum,
      year: payload.year ?? date.getFullYear(),
    }
    store.incomes.push(newIncome)
    updateStore({ incomes: store.incomes })
    return newIncome
  },

  updateIncome(id: string | number, updates: Partial<Income>): void {
    const store = getStore()
    const income = store.incomes.find((i) => String(i.incomeId) === String(id))
    if (income) {
      // Only apply non-undefined values to preserve existing data
      const cleanUpdates: Partial<Income> = {}
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          (cleanUpdates as Record<string, unknown>)[key] = value
        }
      }
      
      // Convert month name to number if provided as string
      if (cleanUpdates.month !== undefined && typeof cleanUpdates.month === 'string') {
        const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
        const idx = MONTH_NAMES.indexOf(cleanUpdates.month.toLowerCase().trim())
        if (idx >= 0) {
          cleanUpdates.month = idx + 1
        }
      }
      
      Object.assign(income, cleanUpdates)
      updateStore({ incomes: store.incomes })
    }
  },

  deleteIncome(id: string | number): void {
    const store = getStore()
    store.incomes = store.incomes.filter((i) => String(i.incomeId) !== String(id))
    updateStore({ incomes: store.incomes })
  },

  // Preferences
  getPreferences(): UserPreferences {
    return { ...getStore().preferences }
  },

  updatePreferences(updates: Partial<UserPreferences>): void {
    const store = getStore()
    Object.assign(store.preferences, updates, { lastUpdateTmstp: new Date().toISOString() })
    updateStore({ preferences: store.preferences })
  },

  // Monthly Balance (for guests, return null to use simple calculation: previous income - current expenses)
  getMonthlyBalance(_month: number, _year: number): MonthlyBalance | null {
    // Return null so dashboard uses: previousMonthIncomeTotal - currentMonthExpenseTotal
    // This matches user expectation: "Total Balance = last month income - current month expenses"
    return null
  },

  // ============================================================================
  // Expense Adjustments
  // ============================================================================

  getAdjustments(): ExpenseAdjustment[] {
    return [...getStore().adjustments]
  },

  getAdjustmentsByUser(page = 0, size = 10): PagedResponse<ExpenseAdjustment> {
    const adjustments = getStore().adjustments
    const start = page * size
    const content = adjustments.slice(start, start + size)
    return {
      content,
      totalElements: adjustments.length,
      totalPages: Math.ceil(adjustments.length / size),
      page,
      size,
    }
  },

  getAdjustmentsByExpense(expenseId: string | number): ExpenseAdjustment[] {
    const store = getStore()
    return store.adjustments.filter(
      (a) => String(a.expensesId) === String(expenseId)
    )
  },

  getAdjustmentsByDateRange(startDate: string, endDate: string, page = 0, size = 10): PagedResponse<ExpenseAdjustment> {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const adjustments = getStore().adjustments.filter((a) => {
      const date = new Date(a.adjustmentDate)
      return date >= start && date <= end
    })
    const startIdx = page * size
    const content = adjustments.slice(startIdx, startIdx + size)
    return {
      content,
      totalElements: adjustments.length,
      totalPages: Math.ceil(adjustments.length / size),
      page,
      size,
    }
  },

  getAdjustmentById(adjustmentId: number): ExpenseAdjustment | null {
    const store = getStore()
    return store.adjustments.find((a) => a.expenseAdjustmentsId === adjustmentId) ?? null
  },

  createAdjustment(payload: {
    expensesId: number | string
    adjustmentType: AdjustmentType
    adjustmentAmount: number
    adjustmentReason?: string
    adjustmentDate: string
    status?: AdjustmentStatus
  }): ExpenseAdjustment {
    const store = getStore()
    // Convert to string for matching - handles both numeric and string IDs
    const expenseIdStr = String(payload.expensesId)
    const expense = store.expenses.find(
      (e) => String(e.expensesId) === expenseIdStr || String(e.expenseId) === expenseIdStr
    )
    
    const maxId = store.adjustments.reduce((max, a) => Math.max(max, a.expenseAdjustmentsId), 0)
    const newAdjustment: ExpenseAdjustment = {
      expenseAdjustmentsId: maxId + 1,
      expensesId: expenseIdStr as unknown as number, // Keep as string for matching
      userId: GUEST_USER_ID,
      adjustmentType: payload.adjustmentType,
      adjustmentAmount: payload.adjustmentAmount,
      adjustmentReason: payload.adjustmentReason,
      adjustmentDate: payload.adjustmentDate,
      status: payload.status ?? 'COMPLETED',
      createdAt: new Date().toISOString(),
      expenseName: expense?.expenseName ?? expense?.description ?? null,
      originalExpenseAmount: expense ? Number(expense.amount ?? expense.expenseAmount) : null,
    }
    
    store.adjustments.push(newAdjustment)
    
    // Update the related expense's totalAdjustments and netExpenseAmount
    if (expense) {
      const totalAdj = store.adjustments
        .filter((a) => String(a.expensesId) === expenseIdStr)
        .reduce((sum, a) => sum + a.adjustmentAmount, 0)
      expense.totalAdjustments = totalAdj
      expense.netExpenseAmount = Number(expense.amount ?? expense.expenseAmount) - totalAdj
    }
    
    updateStore({ adjustments: store.adjustments, expenses: store.expenses })
    return newAdjustment
  },

  updateAdjustment(adjustmentId: number, updates: Partial<ExpenseAdjustment>): ExpenseAdjustment | null {
    const store = getStore()
    const adjustment = store.adjustments.find((a) => a.expenseAdjustmentsId === adjustmentId)
    if (!adjustment) return null
    
    Object.assign(adjustment, updates, { lastUpdateTmstp: new Date().toISOString() })
    
    // Recalculate expense totals
    const expense = store.expenses.find(
      (e) => String(e.expensesId) === String(adjustment.expensesId) || String(e.expenseId) === String(adjustment.expensesId)
    )
    if (expense) {
      const totalAdj = store.adjustments
        .filter((a) => String(a.expensesId) === String(adjustment.expensesId))
        .reduce((sum, a) => sum + a.adjustmentAmount, 0)
      expense.totalAdjustments = totalAdj
      expense.netExpenseAmount = Number(expense.amount ?? expense.expenseAmount) - totalAdj
    }
    
    updateStore({ adjustments: store.adjustments, expenses: store.expenses })
    return adjustment
  },

  deleteAdjustment(adjustmentId: number): boolean {
    const store = getStore()
    const adjustment = store.adjustments.find((a) => a.expenseAdjustmentsId === adjustmentId)
    if (!adjustment) return false
    
    const expenseId = adjustment.expensesId
    store.adjustments = store.adjustments.filter((a) => a.expenseAdjustmentsId !== adjustmentId)
    
    // Recalculate expense totals
    const expense = store.expenses.find(
      (e) => String(e.expensesId) === String(expenseId) || String(e.expenseId) === String(expenseId)
    )
    if (expense) {
      const totalAdj = store.adjustments
        .filter((a) => String(a.expensesId) === String(expenseId))
        .reduce((sum, a) => sum + a.adjustmentAmount, 0)
      expense.totalAdjustments = totalAdj > 0 ? totalAdj : undefined
      expense.netExpenseAmount = totalAdj > 0 ? Number(expense.amount ?? expense.expenseAmount) - totalAdj : undefined
    }
    
    updateStore({ adjustments: store.adjustments, expenses: store.expenses })
    return true
  },

  getTotalAdjustmentForExpense(expenseId: string | number): number {
    const store = getStore()
    return store.adjustments
      .filter((a) => String(a.expensesId) === String(expenseId))
      .reduce((sum, a) => sum + a.adjustmentAmount, 0)
  },

  getTotalAdjustmentForMonth(year: number, month: number): number {
    const store = getStore()
    return store.adjustments
      .filter((a) => {
        const date = new Date(a.adjustmentDate)
        return date.getFullYear() === year && date.getMonth() + 1 === month
      })
      .reduce((sum, a) => sum + a.adjustmentAmount, 0)
  },

  // Clear all guest data (useful for testing)
  clearAll(): void {
    storeData = null
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(STORAGE_KEY)
    }
  },
}

export default guestStore
