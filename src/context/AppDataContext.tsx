import { createContext, useContext } from 'react'
import type { Expense, ExpenseCategory, Income, SessionData, StatusMessage } from '../types/app'

export type AppDataContextValue = {
  session: SessionData | null
  setSession: (session: SessionData | null) => void
  status: StatusMessage | null
  setStatus: (status: StatusMessage | null) => void
  expenseCategories: ExpenseCategory[]
  setExpenseCategories: (
    categories: ExpenseCategory[] | ((previous: ExpenseCategory[]) => ExpenseCategory[]),
  ) => void
  expensesCache: Expense[]
  setExpensesCache: (expenses: Expense[] | ((previous: Expense[]) => Expense[])) => void
  incomesCache: Income[]
  setIncomesCache: (incomes: Income[] | ((previous: Income[]) => Income[])) => void
  ensureExpenseCategories: () => Promise<ExpenseCategory[]>
  reloadExpensesCache: (username: string) => Promise<Expense[]>
  reloadIncomesCache: (username: string) => Promise<Income[]>
}

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined)

export const AppDataProvider = AppDataContext.Provider

export const useAppDataContext = (): AppDataContextValue => {
  const context = useContext(AppDataContext)
  if (!context) {
    throw new Error('useAppDataContext must be used within an AppDataProvider')
  }
  return context
}

export default AppDataContext
