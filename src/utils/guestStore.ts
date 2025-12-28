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
} from '../types/app'

const GUEST_USER_ID = 'guest-user'
const GUEST_USERNAME = 'Guest User'
const STORAGE_KEY = 'guest-store-data'

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

// Generate sample incomes with fixed months (October & November 2025)
// Dashboard shows previous month income, so for December 2025 it shows November 2025
function generateSampleIncomes(): Income[] {
  return [
    // October 2025 - older month (not shown in dashboard when current is December)
    {
      incomeId: generateId('inc'),
      source: 'Salary',
      amount: 45000,
      receivedDate: '2025-10-01',
      month: 10,
      year: 2025,
    },
    // November 2025 - previous month (shown in dashboard Total Income)
    {
      incomeId: generateId('inc'),
      source: 'Salary',
      amount: 50000,
      receivedDate: '2025-11-01',
      month: 11,
      year: 2025,
    },
    {
      incomeId: generateId('inc'),
      source: 'Freelance',
      amount: 12000,
      receivedDate: '2025-11-15',
      month: 11,
      year: 2025,
    },
  ]
}

interface GuestStoreData {
  categories: UserExpenseCategory[]
  userExpenses: UserExpense[]
  expenses: Expense[]
  incomes: Income[]
  preferences: UserPreferences
  initialized: boolean
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
  if (fromSession && fromSession.initialized) {
    storeData = fromSession
    return storeData
  }
  
  // Initialize with default data
  storeData = {
    categories: [...DEFAULT_CATEGORIES],
    userExpenses: [...DEFAULT_USER_EXPENSES],
    expenses: generateSampleExpenses(),
    incomes: generateSampleIncomes(),
    preferences: { ...DEFAULT_PREFERENCES },
    initialized: true,
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

  // Clear all guest data (useful for testing)
  clearAll(): void {
    storeData = null
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(STORAGE_KEY)
    }
  },
}

export default guestStore
