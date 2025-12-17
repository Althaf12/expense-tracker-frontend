import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import {
  addExpense,
  fetchExpensesByMonth,
  fetchIncomeByMonth,
  fetchPreviousMonthlyBalance,
  resolveUserExpenseCategoryId,
  updateUserExpense,
} from '../../api'
import { useAppDataContext } from '../../context/AppDataContext'
import { usePreferences } from '../../context/PreferencesContext'
import type { Expense, Income, UserExpense, UserExpenseCategory } from '../../types/app'
import { formatDate } from '../../utils/format'

const getCurrentMonthContext = () => {
  const current = new Date()
  const month = current.getMonth() + 1
  const year = current.getFullYear()
  const formatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
  return {
    month,
    year,
    label: formatter.format(current),
  }
}

const getPreviousMonth = (month: number, year: number) => {
  if (month === 1) {
    return { month: 12, year: year - 1 }
  }
  return { month: month - 1, year }
}

const amountFromExpense = (expense: Expense): number => {
  const value = expense.amount ?? expense.expenseAmount
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const amountFromIncome = (income: Income): number => {
  const value = income.amount
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const amountFromUserExpense = (expense: UserExpense): number => {
  const value = expense.amount
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const toISODate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type TrendDeltaDirection = 'up' | 'down' | 'flat'
type TrendTone = 'positive' | 'negative' | 'neutral'

type TrendSummary = {
  deltaDirection: TrendDeltaDirection
  tone: TrendTone
  percentage: number | null
}

const calculateTrend = (current: number, previous: number, preferHigher: boolean): TrendSummary => {
  const safeCurrent = Number.isFinite(current) ? current : 0
  const safePrevious = Number.isFinite(previous) ? previous : 0

  if (!Number.isFinite(previous) || previous === 0) {
    const delta = safeCurrent - safePrevious
    if (delta === 0) return { deltaDirection: 'flat', tone: 'neutral', percentage: 0 }
    const improvement = preferHigher ? delta > 0 : delta < 0
    return {
      deltaDirection: delta > 0 ? 'up' : 'down',
      tone: improvement ? 'positive' : 'negative',
      percentage: null,
    }
  }

  const difference = safeCurrent - safePrevious
  if (difference === 0) return { deltaDirection: 'flat', tone: 'neutral', percentage: 0 }

  const percentage = (Math.abs(difference) / Math.abs(safePrevious)) * 100
  const improvement = preferHigher ? difference > 0 : difference < 0

  return {
    deltaDirection: difference > 0 ? 'up' : 'down',
    tone: improvement ? 'positive' : 'negative',
    percentage,
  }
}

type TemplateGroup = {
  categoryId: string
  categoryName: string
  expenses: UserExpense[]
}

export default function useDashboardData() {
  const {
    session,
    setStatus,
    ensureExpenseCategories,
    ensureUserExpenses,
    ensureActiveUserExpenses,
    expenseCategories,
    userExpenses,
    activeUserExpenses,
  } = useAppDataContext()

  const { formatCurrency: preferencesFormatCurrency } = usePreferences()

  const [monthlyExpenses, setMonthlyExpenses] = useState<Expense[]>([])
  const [previousMonthExpenses, setPreviousMonthExpenses] = useState<Expense[]>([])
  const [currentMonthIncome, setCurrentMonthIncome] = useState<Income[]>([])
  const [previousMonthIncome, setPreviousMonthIncome] = useState<Income[]>([])
  const [twoMonthsAgoIncome, setTwoMonthsAgoIncome] = useState<Income[]>([])
  const [monthlyBalanceBase, setMonthlyBalanceBase] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)
  const [expenseTableFilters, setExpenseTableFilters] = useState({ name: '', amount: '', date: '' })
  const [categoryTableFilters, setCategoryTableFilters] = useState({ name: '', total: '' })
  const [templateCategoryOrder, setTemplateCategoryOrder] = useState<string[]>([])
  const [templateSaving, setTemplateSaving] = useState<Record<string, boolean>>({})
  const dragCategoryIdRef = useRef<string | null>(null)
  // Pagination state for current month expenses
  const [expenseCurrentPage, setExpenseCurrentPage] = useState<number>(0)
  const [expensePageSize, setExpensePageSize] = useState<number>(20)
  const [expenseTotalElements, setExpenseTotalElements] = useState<number>(0)
  const [expenseTotalPages, setExpenseTotalPages] = useState<number>(1)

  const visibleTemplates = useMemo(() => activeUserExpenses.filter((expense) => (expense.status ?? 'A') === 'A'), [activeUserExpenses])

  const { month, year, label } = useMemo(() => getCurrentMonthContext(), [])
  const previousContext = useMemo(() => getPreviousMonth(month, year), [month, year])
  const twoMonthsAgoContext = useMemo(() => getPreviousMonth(previousContext.month, previousContext.year), [previousContext.month, previousContext.year])

  // monthly balance base is loaded via API helper which implements caching/dedupe

  useEffect(() => {
    if (!session) {
      setMonthlyExpenses([])
      setPreviousMonthExpenses([])
      setCurrentMonthIncome([])
      setPreviousMonthIncome([])
      setTwoMonthsAgoIncome([])
      setMonthlyBalanceBase(0)
      return
    }

    const username = session.username
    setLoading(true)
    setStatus({ type: 'loading', message: 'Loading dashboard...' })

    void (async () => {
      try {
        const [
          currentExpensesResponse,
          previousExpensesResponse,
          currentIncomeResponse,
          previousIncomeResponse,
          twoMonthsAgoIncomeResponse,
          previousMonthBalance,
        ] = await Promise.all([
          fetchExpensesByMonth({ username, month, year, page: expenseCurrentPage, size: expensePageSize }),
          fetchExpensesByMonth({ username, month: previousContext.month, year: previousContext.year }),
          fetchIncomeByMonth({ username, month, year }),
          fetchIncomeByMonth({ username, month: previousContext.month, year: previousContext.year }),
          fetchIncomeByMonth({ username, month: twoMonthsAgoContext.month, year: twoMonthsAgoContext.year }),
          fetchPreviousMonthlyBalance(username),
        ])

        await Promise.all([ensureExpenseCategories(), ensureUserExpenses(), ensureActiveUserExpenses()])

        setMonthlyExpenses(currentExpensesResponse.content)
        setExpenseTotalElements(currentExpensesResponse.totalElements)
        setExpenseTotalPages(currentExpensesResponse.totalPages)
        setExpenseCurrentPage(currentExpensesResponse.page)
        setPreviousMonthExpenses(previousExpensesResponse.content)
        setCurrentMonthIncome(currentIncomeResponse.content)
        setPreviousMonthIncome(previousIncomeResponse.content)
        setTwoMonthsAgoIncome(twoMonthsAgoIncomeResponse.content)

        const mb = previousMonthBalance as (import('../../types/app').MonthlyBalance | null)
        const resolved = mb ? (typeof mb.closingBalance === 'number' ? mb.closingBalance : typeof mb.openingBalance === 'number' ? mb.openingBalance : 0) : 0
        setMonthlyBalanceBase(resolved)
        setStatus(null)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStatus({ type: 'error', message })
      } finally {
        setLoading(false)
      }
    })()
  }, [
    session,
    ensureExpenseCategories,
    ensureUserExpenses,
    ensureActiveUserExpenses,
    month,
    year,
    previousContext.month,
    previousContext.year,
    twoMonthsAgoContext.month,
    twoMonthsAgoContext.year,
    setStatus,
  ])

  // Listen for monthly balance updates dispatched by the global scheduler
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (ev: Event) => {
      try {
        const detail = (ev as CustomEvent)?.detail
        if (!detail) return
        const { username: updatedUsername, balance } = detail as { username?: string; balance?: number }
        if (!session || updatedUsername !== session.username) return
        if (typeof balance === 'number') {
          setMonthlyBalanceBase(balance)
          return
        }
        // fallback: re-fetch via API helper (which is cached/dedupe)
        void (async () => {
          try {
            const mb = await fetchPreviousMonthlyBalance(session.username)
            const resolved = mb ? (typeof mb.closingBalance === 'number' ? mb.closingBalance : typeof mb.openingBalance === 'number' ? mb.openingBalance : 0) : 0
            setMonthlyBalanceBase(resolved)
          } catch {
            /* ignore */
          }
        })()
      } catch {
        /* ignore errors */
      }
    }

    window.addEventListener('monthlyBalanceUpdated', handler as EventListener)
    return () => window.removeEventListener('monthlyBalanceUpdated', handler as EventListener)
  }, [session])

  const filteredMonthlyExpenses = useMemo(() => {
    const nameQuery = expenseTableFilters.name.trim().toLowerCase()
    const amountQuery = expenseTableFilters.amount.trim().toLowerCase()
    const dateQuery = expenseTableFilters.date.trim().toLowerCase()

    if (!nameQuery && !amountQuery && !dateQuery) return monthlyExpenses

    return monthlyExpenses.filter((expense) => {
      const expenseName = (expense.expenseName ?? expense.description ?? '').toString().toLowerCase()
      const numericAmount = amountFromExpense(expense)
      const amountString = Number.isFinite(numericAmount) ? numericAmount.toFixed(2) : ''
      const formattedAmount = preferencesFormatCurrency(numericAmount).toLowerCase()
      const rawDate = (expense.expenseDate ?? '').toString().toLowerCase()
      const prettyDate = formatDate(expense.expenseDate).toLowerCase()

      if (nameQuery && !expenseName.includes(nameQuery)) return false
      if (amountQuery && !amountString.includes(amountQuery) && !formattedAmount.includes(amountQuery)) return false
      if (dateQuery && !rawDate.includes(dateQuery) && !prettyDate.includes(dateQuery)) return false
      return true
    })
  }, [monthlyExpenses, expenseTableFilters])

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>()
    expenseCategories.forEach((category) => {
      map.set(String(category.userExpenseCategoryId), category.userExpenseCategoryName)
    })
    return map
  }, [expenseCategories])

  const categoryNameLookup = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    expenseCategories.forEach((category) => {
      const key = category.userExpenseCategoryName.trim().toLowerCase()
      if (key.length > 0) {
        map.set(key, { id: String(category.userExpenseCategoryId), name: category.userExpenseCategoryName })
      }
    })
    return map
  }, [expenseCategories])

  const resolveCategoryForExpense = useCallback(
    (expense: UserExpense): { id: string; name: string } => {
      const rawCategoryId =
        expense.userExpenseCategoryId ??
        (expense as UserExpense & { expenseCategoryId?: string | number }).expenseCategoryId

      if (rawCategoryId !== undefined && rawCategoryId !== null) {
        const id = String(rawCategoryId)
        const explicitName = expense.userExpenseCategoryName?.trim()
        const alternativeName = (expense as UserExpense & { expenseCategoryName?: string }).expenseCategoryName?.trim()
        const resolvedName = explicitName && explicitName.length > 0 ? explicitName : alternativeName && alternativeName.length > 0 ? alternativeName : categoryNameMap.get(id)
        return { id, name: resolvedName && resolvedName.length > 0 ? resolvedName : 'Uncategorised' }
      }

      const candidateName =
        (expense.userExpenseCategoryName ?? (expense as UserExpense & { expenseCategoryName?: string }).expenseCategoryName ?? '').trim()

      if (candidateName.length > 0) {
        const lookupEntry = categoryNameLookup.get(candidateName.toLowerCase())
        if (lookupEntry) {
          const mappedName = categoryNameMap.get(lookupEntry.id) ?? lookupEntry.name
          return { id: lookupEntry.id, name: mappedName }
        }
        return { id: `name:${candidateName.toLowerCase()}`, name: candidateName }
      }

      return { id: 'uncategorised', name: 'Uncategorised' }
    },
    [categoryNameLookup, categoryNameMap],
  )

  const activeCategoryIds = useMemo(() => {
    const seen = new Set<string>()
    const ordered: string[] = []
    visibleTemplates.forEach((expense) => {
      const { id } = resolveCategoryForExpense(expense)
      if (!seen.has(id)) {
        seen.add(id)
        ordered.push(id)
      }
    })
    return ordered
  }, [resolveCategoryForExpense, visibleTemplates])

  const categoryOrderStorageKey = useMemo(() => (session ? `dashboard:template-category-order:${session.username}` : null), [session?.username])

  useEffect(() => {
    if (!session) {
      setTemplateCategoryOrder([])
      return
    }
    if (activeCategoryIds.length === 0) {
      setTemplateCategoryOrder([])
      return
    }

    let stored: string[] = []
    if (categoryOrderStorageKey) {
      try {
        const raw = window.localStorage.getItem(categoryOrderStorageKey)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            stored = parsed.filter((value): value is string => typeof value === 'string')
          }
        }
      } catch {
        /* ignore */
      }
    }

    const filteredStored = stored.filter((id) => activeCategoryIds.includes(id))
    const missing = activeCategoryIds.filter((id) => !filteredStored.includes(id))
    const nextOrder = [...filteredStored, ...missing]

    setTemplateCategoryOrder((previous) => {
      if (previous.length === nextOrder.length && previous.every((value, index) => value === nextOrder[index])) return previous
      return nextOrder
    })
  }, [session, activeCategoryIds, categoryOrderStorageKey])

  useEffect(() => {
    if (!categoryOrderStorageKey) return
    if (templateCategoryOrder.length === 0 && activeCategoryIds.length === 0) return
    try {
      window.localStorage.setItem(categoryOrderStorageKey, JSON.stringify(templateCategoryOrder))
    } catch {
      /* ignore */
    }
  }, [activeCategoryIds.length, categoryOrderStorageKey, templateCategoryOrder])

  const groupedUserExpenses = useMemo(() => {
    const groups = new Map<string, TemplateGroup>()
    visibleTemplates.forEach((expense) => {
      const { id, name } = resolveCategoryForExpense(expense)
      if (!groups.has(id)) {
        groups.set(id, { categoryId: id, categoryName: name, expenses: [] })
      }
      const group = groups.get(id)
      if (group) {
        group.categoryName = name
        group.expenses.push(expense)
      }
    })

    const allGroups = Array.from(groups.values())
    allGroups.sort((a, b) => {
      const indexA = templateCategoryOrder.indexOf(a.categoryId)
      const indexB = templateCategoryOrder.indexOf(b.categoryId)
      if (indexA !== -1 || indexB !== -1) {
        if (indexA === -1) return 1
        if (indexB === -1) return -1
        return indexA - indexB
      }
      return activeCategoryIds.indexOf(a.categoryId) - activeCategoryIds.indexOf(b.categoryId)
    })

    return allGroups
  }, [visibleTemplates, expenseCategories, templateCategoryOrder])

  const expenseTemplatesTotal = useMemo(() => visibleTemplates.reduce((sum, expense) => sum + amountFromUserExpense(expense), 0), [visibleTemplates])

  const completedMonthlyTemplates = useMemo(() => visibleTemplates.filter((expense) => (expense.paid ?? 'N') === 'Y').length, [visibleTemplates])

  const monthlyTemplateProgress = useMemo(() => (visibleTemplates.length === 0 ? 0 : (completedMonthlyTemplates / visibleTemplates.length) * 100), [visibleTemplates.length, completedMonthlyTemplates])

  const unpaidPlannedExpensesTotal = useMemo(() => visibleTemplates.reduce((sum, expense) => ((expense.paid ?? 'N') === 'Y' ? sum : sum + amountFromUserExpense(expense)), 0), [visibleTemplates])

  const monthlyTotal = useMemo(() => filteredMonthlyExpenses.reduce((sum, expense) => sum + amountFromExpense(expense), 0), [filteredMonthlyExpenses])

  const currentMonthExpenseTotal = useMemo(() => monthlyExpenses.reduce((sum, expense) => sum + amountFromExpense(expense), 0), [monthlyExpenses])

  const previousMonthExpenseTotal = useMemo(() => previousMonthExpenses.reduce((sum, expense) => sum + amountFromExpense(expense), 0), [previousMonthExpenses])

  const currentMonthIncomeTotal = useMemo(() => currentMonthIncome.reduce((sum, income) => sum + amountFromIncome(income), 0), [currentMonthIncome])

  const previousMonthIncomeTotal = useMemo(() => previousMonthIncome.reduce((sum, income) => sum + amountFromIncome(income), 0), [previousMonthIncome])

  const twoMonthsAgoIncomeTotal = useMemo(() => twoMonthsAgoIncome.reduce((sum, income) => sum + amountFromIncome(income), 0), [twoMonthsAgoIncome])

  const totalBalance = useMemo(
    () => (monthlyBalanceBase ?? 0) + previousMonthIncomeTotal - currentMonthExpenseTotal,
    [monthlyBalanceBase, previousMonthIncomeTotal, currentMonthExpenseTotal],
  )

  const previousBalance = useMemo(() => previousMonthIncomeTotal - previousMonthExpenseTotal, [previousMonthIncomeTotal, previousMonthExpenseTotal])

  const balanceTrend = useMemo(() => calculateTrend(totalBalance, previousBalance, true), [totalBalance, previousBalance])

  const incomeTrend = useMemo(() => calculateTrend(previousMonthIncomeTotal, twoMonthsAgoIncomeTotal, true), [previousMonthIncomeTotal, twoMonthsAgoIncomeTotal])

  const expenseTrend = useMemo(() => calculateTrend(currentMonthExpenseTotal, previousMonthExpenseTotal, false), [currentMonthExpenseTotal, previousMonthExpenseTotal])

  const totalAfterDueBalance = useMemo(() => totalBalance - unpaidPlannedExpensesTotal, [totalBalance, unpaidPlannedExpensesTotal])

  // Currency formatting is provided by preferences via `preferencesFormatCurrency`.
  // Removed local `currencyFormatter` that referenced an undefined `currencyCode`.

  const incomeMonthLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
    return formatter.format(new Date(previousContext.year, previousContext.month - 1))
  }, [previousContext.month, previousContext.year])

  const getTrendHint = (trend: TrendSummary | null) => (trend && trend.percentage !== null ? 'vs previous month' : 'Insufficient data')

  // `renderTrend` is a presentational helper (returns JSX with CSS classes)
  // and should live in the presentational component (`Dashboard.tsx`).
  // Expose only trend data from the hook; the component will render it.

  const handleCategoryDragStart = useCallback((categoryId: string) => {
    dragCategoryIdRef.current = categoryId
  }, [])

  const handleCategoryDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleCategoryDrop = useCallback((event: DragEvent<HTMLElement>, targetId: string) => {
    event.preventDefault()
    const sourceId = dragCategoryIdRef.current
    dragCategoryIdRef.current = null
    if (!sourceId || sourceId === targetId) return
    setTemplateCategoryOrder((previous) => {
      const next = [...previous]
      const sourceIndex = next.indexOf(sourceId)
      const targetIndex = next.indexOf(targetId)
      if (sourceIndex === -1 || targetIndex === -1) return next
      next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, sourceId)
      return next
    })
  }, [])

  const handleCategoryDragEnd = useCallback(() => {
    dragCategoryIdRef.current = null
  }, [])

  const handleTemplateMarkPaid = useCallback(async (expense: UserExpense) => {
    const expenseId = String(expense.userExpensesId)
    if ((expense.paid ?? 'N') === 'Y') return
    if (!session) {
      setStatus({ type: 'error', message: 'You need to be signed in to record expenses.' })
      return
    }

    const amount = amountFromUserExpense(expense)
    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus({ type: 'error', message: 'Template amount must be greater than zero before recording.' })
      return
    }

    const categoryName = expense.userExpenseCategoryName && expense.userExpenseCategoryName.trim().length > 0 ? expense.userExpenseCategoryName : (expense as UserExpense & { expenseCategoryName?: string }).expenseCategoryName

    if (!categoryName) {
      setStatus({ type: 'error', message: 'Template is missing a category name. Update it in your profile first.' })
      return
    }

    const expenseDate = toISODate(new Date())
    setTemplateSaving((previous) => ({ ...previous, [expenseId]: true }))
    let paidUpdated = false
    try {
      await updateUserExpense({ username: session.username, id: expense.userExpensesId, paid: 'Y' })
      paidUpdated = true

      const resolvedCategoryId = await resolveUserExpenseCategoryId({ username: session.username, userExpenseCategoryName: categoryName })
      if (resolvedCategoryId === null || resolvedCategoryId === undefined) throw new Error(`Could not find a category for "${categoryName}".`)

      await addExpense({ username: session.username, userExpenseCategoryId: resolvedCategoryId, expenseAmount: amount, expenseDate, expenseName: expense.userExpenseName })

      setStatus({ type: 'success', message: `${expense.userExpenseName} marked as paid for this month.` })

      await Promise.all([ensureActiveUserExpenses(), ensureUserExpenses()])

      const refreshed = await fetchExpensesByMonth({ username: session.username, month, year, page: expenseCurrentPage, size: expensePageSize })
      setMonthlyExpenses(refreshed.content)
      setExpenseTotalElements(refreshed.totalElements)
      setExpenseTotalPages(refreshed.totalPages)
    } catch (error) {
      if (paidUpdated) {
        try {
          await updateUserExpense({ username: session.username, id: expense.userExpensesId, paid: 'N' })
        } catch {
          /* ignore */
        }
      }
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    } finally {
      setTemplateSaving((previous) => {
        const next = { ...previous }
        delete next[expenseId]
        return next
      })
    }
  }, [ensureActiveUserExpenses, ensureUserExpenses, month, session, setStatus, year])

  const handleResetMonthlyStatus = useCallback(async () => {
    if (!session) {
      setStatus({ type: 'error', message: 'You need to be signed in to reset the month.' })
      return
    }

    const confirmationMessage = 'Do this only if you want to start with a new month. This will reset your balance amount. Continue?'
    const confirmed = typeof window !== 'undefined' ? window.confirm(confirmationMessage) : true
    if (!confirmed) return

    if (visibleTemplates.length === 0) {
      setStatus({ type: 'info', message: 'No active expense templates need resetting.' })
      return
    }

    setTemplateSaving(visibleTemplates.reduce<Record<string, boolean>>((acc, item) => {
      acc[String(item.userExpensesId)] = true
      return acc
    }, {}))

    try {
      await Promise.all(visibleTemplates.map((expense) => updateUserExpense({ username: session.username, id: expense.userExpensesId, paid: 'N' })))

      await Promise.all([ensureActiveUserExpenses(), ensureUserExpenses()])
      setStatus({ type: 'success', message: 'Monthly template status reset. All templates are marked unpaid.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    } finally {
      setTemplateSaving({})
    }
  }, [ensureActiveUserExpenses, ensureUserExpenses, session, setStatus, visibleTemplates])

  const categorySummary = useMemo(() => {
    const totals = new Map<string, { name: string; total: number }>()

    monthlyExpenses.forEach((expense) => {
      const explicitName = (expense as Expense & { userExpenseCategoryName?: string }).userExpenseCategoryName ?? (expense as Expense & { expenseCategoryName?: string }).expenseCategoryName
      const rawId = (expense as Expense & { userExpenseCategoryId?: string | number }).userExpenseCategoryId ?? expense.expenseCategoryId

      let name: string
      if (rawId !== undefined && rawId !== null) {
        const mapped = categoryNameMap.get(String(rawId))
        name = explicitName ?? mapped ?? 'Uncategorised'
      } else {
        const candidate = (explicitName ?? '').toString().trim()
        if (candidate.length > 0) {
          const lookup = categoryNameLookup.get(candidate.toLowerCase())
          if (lookup) {
            name = categoryNameMap.get(lookup.id) ?? lookup.name
          } else {
            name = candidate
          }
        } else {
          name = 'Uncategorised'
        }
      }

      const amount = amountFromExpense(expense)
      if (!totals.has(name)) totals.set(name, { name, total: 0 })
      const entry = totals.get(name)
      if (entry) entry.total += amount
    })

    return Array.from(totals.values()).sort((a, b) => b.total - a.total)
  }, [monthlyExpenses, categoryNameMap, categoryNameLookup])

  const filteredCategorySummary = useMemo(() => {
    const nameQuery = categoryTableFilters.name.trim().toLowerCase()
    const totalQuery = categoryTableFilters.total.trim().toLowerCase()
    if (!nameQuery && !totalQuery) return categorySummary
    return categorySummary.filter((entry) => {
      const nameValue = entry.name.toLowerCase()
      const totalString = entry.total.toFixed(2)
      const formattedTotal = preferencesFormatCurrency(entry.total).toLowerCase()
      if (nameQuery && !nameValue.includes(nameQuery)) return false
      if (totalQuery && !totalString.includes(totalQuery) && !formattedTotal.includes(totalQuery)) return false
      return true
    })
  }, [categorySummary, categoryTableFilters])

  const expenseFiltersApplied = useMemo(() => Object.values(expenseTableFilters).some((value) => value.trim().length > 0), [expenseTableFilters])

  const categoryFiltersApplied = useMemo(() => Object.values(categoryTableFilters).some((value) => value.trim().length > 0), [categoryTableFilters])

  const handleExpenseFilterChange = (field: 'name' | 'amount' | 'date', value: string) => setExpenseTableFilters((previous) => ({ ...previous, [field]: value }))

  const handleCategoryFilterChange = (field: 'name' | 'total', value: string) => setCategoryTableFilters((previous) => ({ ...previous, [field]: value }))

  const clearExpenseFilters = () => setExpenseTableFilters({ name: '', amount: '', date: '' })
  const clearCategoryFilters = () => setCategoryTableFilters({ name: '', total: '' })

  const handleExpensePageChange = useCallback((page: number) => {
    if (!session) return
    const username = session.username
    setExpenseCurrentPage(page)
    setLoading(true)
    void (async () => {
      try {
        const response = await fetchExpensesByMonth({ username, month, year, page, size: expensePageSize })
        setMonthlyExpenses(response.content)
        setExpenseTotalElements(response.totalElements)
        setExpenseTotalPages(response.totalPages)
        setExpenseCurrentPage(response.page)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStatus({ type: 'error', message })
      } finally {
        setLoading(false)
      }
    })()
  }, [session, month, year, expensePageSize, setStatus])

  const handleExpensePageSizeChange = useCallback((size: number) => {
    if (!session) return
    const username = session.username
    setExpensePageSize(size)
    setExpenseCurrentPage(0)
    setLoading(true)
    void (async () => {
      try {
        const response = await fetchExpensesByMonth({ username, month, year, page: 0, size })
        setMonthlyExpenses(response.content)
        setExpenseTotalElements(response.totalElements)
        setExpenseTotalPages(response.totalPages)
        setExpenseCurrentPage(response.page)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStatus({ type: 'error', message })
      } finally {
        setLoading(false)
      }
    })()
  }, [session, month, year, setStatus])

  return {
    userExpenses,
    session,
    setStatus,
    loading,
    monthlyExpenses,
    previousMonthExpenses,
    currentMonthIncome,
    previousMonthIncome,
    twoMonthsAgoIncome,
    expenseTableFilters,
    categoryTableFilters,
    templateCategoryOrder,
    templateSaving,
    visibleTemplates,
    month,
    year,
    label,
    previousContext,
    twoMonthsAgoContext,
    filteredMonthlyExpenses,
    categoryNameMap,
    categoryNameLookup,
    resolveCategoryForExpense,
    activeCategoryIds,
    groupedUserExpenses,
    expenseTemplatesTotal,
    completedMonthlyTemplates,
    monthlyTemplateProgress,
    unpaidPlannedExpensesTotal,
    monthlyTotal,
    currentMonthExpenseTotal,
    previousMonthExpenseTotal,
    currentMonthIncomeTotal,
    previousMonthIncomeTotal,
    twoMonthsAgoIncomeTotal,
    totalBalance,
    previousBalance,
    balanceTrend,
    incomeTrend,
    expenseTrend,
    totalAfterDueBalance,
    formatCurrency: preferencesFormatCurrency,
    incomeMonthLabel,
    getTrendHint,
    handleCategoryDragStart,
    handleCategoryDragOver,
    handleCategoryDrop,
    handleCategoryDragEnd,
    handleTemplateMarkPaid,
    handleResetMonthlyStatus,
    handleExpenseFilterChange,
    handleCategoryFilterChange,
    clearExpenseFilters,
    clearCategoryFilters,
    categorySummary,
    filteredCategorySummary,
    expenseFiltersApplied,
    categoryFiltersApplied,
    // Pagination
    expenseCurrentPage,
    expensePageSize,
    expenseTotalElements,
    expenseTotalPages,
    handleExpensePageChange,
    handleExpensePageSizeChange,
  }
}
