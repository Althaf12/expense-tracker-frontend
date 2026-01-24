import Grid from '@mui/material/Grid'
import { Typography } from '@mui/material'
import React, { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react'
import { 
  Search, 
  Plus, 
  Trash2, 
  Pencil, 
  Check, 
  X, 
  Calendar, 
  Filter,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCcw,
  Eye,
  EyeOff
} from 'lucide-react'
import {
  addExpense,
  deleteExpense,
  fetchExpensesByMonth,
  fetchExpensesByRange,
  updateExpense,
  fetchExpenseAdjustmentsByExpense,
  createExpenseAdjustment,
} from '../../api'
import type { Expense, UserExpenseCategory, PagedResponse, ExpenseAdjustment, AdjustmentType } from '../../types/app'
import { useAppDataContext } from '../../context/AppDataContext'
import { formatDate, parseAmount, friendlyErrorMessage } from '../../utils/format'
import { usePreferences } from '../../context/PreferencesContext'
import { guestStore } from '../../utils/guestStore'
import styles from './ExpensesOperations.module.css'
import Skeleton from '../../components/Skeleton'
import Pagination from '../../components/Pagination'
import ExportModal from '../../components/ExportModal'

const DEFAULT_PAGE_SIZE = 20

type ViewMode = 'month' | 'range'

type ExpenseFormState = {
  expenseCategoryId: string
  categoryName: string
  amount: string
  expenseDate: string
  expenseName: string
}

type InlineEditDraft = {
  expenseName: string
  expenseCategoryId: string
  expenseCategoryName: string
  expenseAmount: string
  expenseDate: string
}

type TableFilters = {
  expenseName: string
  category: string
  amount: string
  date: string
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const initialFormState: ExpenseFormState = {
  expenseCategoryId: '',
  categoryName: '',
  amount: '',
  expenseDate: '',
  expenseName: '',
}

const ensureId = (expense: Expense): string =>
  String(
    expense.expensesId ??
      expense.expenseId ??
      `${expense.expenseName ?? expense.description ?? 'expense'}-${expense.expenseDate ?? ''}`,
  )

const getAmount = (expense: Expense): number => {
  const value = expense.amount ?? expense.expenseAmount
  return typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0
}

type ExpenseWithUserCategory = Expense & {
  userExpenseCategoryId?: string | number
  userExpenseCategoryName?: string
}

const extractExpenseCategoryId = (expense: ExpenseWithUserCategory): string => {
  const raw =
    expense.expenseCategoryId ??
    expense.userExpenseCategoryId ??
    (expense as Expense & { categoryId?: string | number }).categoryId
  if (raw === undefined || raw === null) {
    return ''
  }
  const text = String(raw).trim()
  return text
}

const extractExpenseCategoryName = (
  expense: ExpenseWithUserCategory,
  categories: UserExpenseCategory[],
): string => {
  const explicit =
    expense.userExpenseCategoryName ??
    expense.expenseCategoryName ??
    (expense as Expense & { categoryName?: string }).categoryName
  if (explicit && explicit.trim().length > 0) {
    return explicit
  }
  const id = extractExpenseCategoryId(expense)
  if (!id) return ''
  const match = categories.find((category) => String(category.userExpenseCategoryId) === id)
  return match?.userExpenseCategoryName ?? ''
}

export default function ExpensesOperations(): ReactElement {
  const {
    session,
    setStatus,
    ensureExpenseCategories,
    expenseCategories,
    expensesCache,
    reloadExpensesCache,
  } = useAppDataContext()
  const { formatCurrency } = usePreferences()

  // Local active categories state — use the active-only API for operations UI so
  // profile page can still fetch/preview 'all' categories without affecting this view.
  const [activeCategories, setActiveCategories] = useState<UserExpenseCategory[]>([])

  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [rangeStart, setRangeStart] = useState<string>('')
  const [rangeEnd, setRangeEnd] = useState<string>('')
  const [results, setResults] = useState<Expense[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [formState, setFormState] = useState<ExpenseFormState>(initialFormState)
  const [lastQuery, setLastQuery] = useState<{ mode: ViewMode; payload?: Record<string, unknown> } | null>(null)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingRowDraft, setEditingRowDraft] = useState<InlineEditDraft | null>(null)
  const [addingInline, setAddingInline] = useState<boolean>(false)
  const [inlineAddDraft, setInlineAddDraft] = useState<InlineEditDraft | null>(null)
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState<boolean>(false)
  const categoryFieldRef = useRef<HTMLLabelElement | null>(null)
  const inlineCategoryFieldRef = useRef<HTMLDivElement | null>(null)
  const initialLoadRef = useRef<boolean>(false)
  const [editingCategoryDropdownOpen, setEditingCategoryDropdownOpen] = useState<boolean>(false)
  const [tableFilters, setTableFilters] = useState<TableFilters>({ expenseName: '', category: '', amount: '', date: '' })
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(0)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [totalElements, setTotalElements] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(1)
  // Export modal state
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false)
  // Expense adjustments inline state
  const [expandedExpenseIds, setExpandedExpenseIds] = useState<Set<string>>(new Set())
  const [expenseAdjustmentsCache, setExpenseAdjustmentsCache] = useState<Map<string, ExpenseAdjustment[]>>(new Map())
  const [loadingAdjustments, setLoadingAdjustments] = useState<Set<string>>(new Set())
  // Inline adjustment form state
  const [showAdjustmentForm, setShowAdjustmentForm] = useState<string | null>(null) // expenseId when form is visible
  const [adjustmentFormData, setAdjustmentFormData] = useState<{
    adjustmentType: AdjustmentType
    adjustmentAmount: string
    adjustmentReason: string
  }>({ adjustmentType: 'REFUND', adjustmentAmount: '', adjustmentReason: '' })
  const [savingAdjustment, setSavingAdjustment] = useState(false)

  useEffect(() => {
    if (!session) return
    if (initialLoadRef.current) return
    initialLoadRef.current = true

    const now = new Date()
    const defaultMonth = now.getMonth() + 1
    const defaultYear = now.getFullYear()

    setSelectedMonth(defaultMonth)
    setSelectedYear(defaultYear)

    // Always refresh categories from API before loading expenses for defaults
    void (async () => {
      await ensureExpenseCategories()
      // Ensure categories are loaded via context helper and derive active list
      try {
        const list = await ensureExpenseCategories()
        const filtered = Array.isArray(list) ? list.filter((c) => (c as any).status === 'A') : []
        setActiveCategories(filtered)
        // Debug: log active vs context categories to help trace unexpected 'all' categories
        // eslint-disable-next-line no-console
        console.debug('ExpensesOperations: activeCategories derived', filtered.length, filtered.map((c) => c.userExpenseCategoryName))
      } catch (err) {
        // non-fatal — keep context categories as fallback
      }

      // Inline initial load to avoid closure issues with loadExpenses
      setLoading(true)
      setStatus({ type: 'loading', message: 'Fetching expenses...' })
      try {
        const response = await fetchExpensesByMonth({
          userId: session.userId,
          month: defaultMonth,
          year: defaultYear,
          page: 0,
          size: DEFAULT_PAGE_SIZE,
        })
        setResults(response.content)
        setCurrentPage(response.page)
        setTotalElements(response.totalElements)
        setTotalPages(response.totalPages)
        setLastQuery({ mode: 'month', payload: { month: defaultMonth, year: defaultYear } })
        setStatus(null)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStatus({ type: 'error', message: friendlyErrorMessage(message, 'fetching expenses') })
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  useEffect(() => {
    if (!categoryDropdownOpen) return

    const handleClickAway = (event: MouseEvent) => {
      if (categoryFieldRef.current && !categoryFieldRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickAway)
    return () => {
      document.removeEventListener('mousedown', handleClickAway)
    }
  }, [categoryDropdownOpen])

  useEffect(() => {
    if (!editingCategoryDropdownOpen) return

    const handleClickAway = (event: MouseEvent) => {
      if (inlineCategoryFieldRef.current && !inlineCategoryFieldRef.current.contains(event.target as Node)) {
        setEditingCategoryDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickAway)
    return () => {
      document.removeEventListener('mousedown', handleClickAway)
    }
  }, [editingCategoryDropdownOpen])

  useEffect(() => {
    if (!editingRowId) {
      setEditingCategoryDropdownOpen(false)
    }
  }, [editingRowId])

  useEffect(() => {
    const selectedCategoryId = formState.expenseCategoryId
    if (!selectedCategoryId) {
      return
    }

    const match = activeCategories.find(
      (category) => String(category.userExpenseCategoryId) === String(selectedCategoryId),
    )

    if (!match) {
      setFormState((previous) => ({
        ...previous,
        expenseCategoryId: '',
        categoryName: '',
      }))
      return
    }

    if (formState.categoryName !== match.userExpenseCategoryName) {
      setFormState((previous) => ({
        ...previous,
        categoryName: match.userExpenseCategoryName,
      }))
    }
  }, [activeCategories, formState.expenseCategoryId, formState.categoryName])

  const editingCategoryId = editingRowDraft?.expenseCategoryId ?? ''

  useEffect(() => {
    if (!editingCategoryId) {
      return
    }

    const exists = activeCategories.some(
      (category) => String(category.userExpenseCategoryId) === String(editingCategoryId),
    )

    if (!exists) {
      // Don't clear the draft if the category isn't in the active list.
      // The category may be inactive but still valid for this expense.
      // Try to resolve a display name from the full category list in
      // context (`expenseCategories`) and preserve the id so the user
      // doesn't have to re-select it when saving unchanged.
      const fallback = (window as any).__appContextExpenseCategories as UserExpenseCategory[] | undefined
      // Prefer using local `expenseCategories` from context if available.
      // We can't import it directly here, so use the value from closure if present.
      // If none available, leave the draft unchanged.
      // Attempt to read from `expenseCategories` via the closure (defined above in the component).
      // If not, try a no-op to avoid clearing the user's selection.
      // (Preserve existing draft.)
      setEditingRowDraft((previous) => {
        if (!previous) return previous
        // If an explicit name is already present, keep it. Otherwise try to resolve.
        if (previous.expenseCategoryName && previous.expenseCategoryName.trim().length > 0) {
          return previous
        }
        // Try to find in activeCategories first (already known missing), then fallback to full list
        // Try to access `expenseCategories` from the outer scope (closure) if available
        try {
          // `expenseCategories` is available in this component scope; use it if present
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const fullList = (globalThis as any).expenseCategoriesForOps ?? []
          const match = Array.isArray(fullList)
            ? (fullList as UserExpenseCategory[]).find((c) => String(c.userExpenseCategoryId) === String(previous.expenseCategoryId))
            : undefined
          if (match) {
            return { ...previous, expenseCategoryName: match.userExpenseCategoryName }
          }
        } catch {
          // ignore
        }
        // If we couldn't resolve a name, preserve id and name as-is (do not clear)
        return previous
      })
    }
  }, [activeCategories, editingCategoryId])

  const categorySuggestions = useMemo(() => {
    const query = formState.categoryName.trim().toLowerCase()
    if (!query) return activeCategories
    return activeCategories.filter((category) =>
      category.userExpenseCategoryName.toLowerCase().includes(query),
    )
  }, [formState.categoryName, activeCategories])

  const editingCategorySuggestions = useMemo(() => {
    if (!editingRowDraft) return activeCategories
    const query = editingRowDraft.expenseCategoryName.trim().toLowerCase()
    if (!query) return activeCategories
    return activeCategories.filter((category) =>
      category.userExpenseCategoryName.toLowerCase().includes(query),
    )
  }, [editingRowDraft, activeCategories])

  const [inlineCategoryDropdownOpen, setInlineCategoryDropdownOpen] = useState<boolean>(false)

  useEffect(() => {
    if (!inlineCategoryDropdownOpen) return

    const handleClickAway = (event: MouseEvent) => {
      if (inlineCategoryFieldRef.current && !inlineCategoryFieldRef.current.contains(event.target as Node)) {
        setInlineCategoryDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickAway)
    return () => {
      document.removeEventListener('mousedown', handleClickAway)
    }
  }, [inlineCategoryDropdownOpen])

  const beginInlineAdd = () => {
    setAddingInline(true)
    setInlineAddDraft({
      expenseName: '',
      expenseCategoryId: '',
      expenseCategoryName: '',
      expenseAmount: '',
      expenseDate: new Date().toISOString().slice(0, 10),
    })
    setInlineCategoryDropdownOpen(false)
    setEditingRowId(null)
  }

  const cancelInlineAdd = () => {
    setAddingInline(false)
    setInlineAddDraft(null)
    setInlineCategoryDropdownOpen(false)
  }

  const updateInlineAddDraft = (field: keyof InlineEditDraft, value: string) => {
    setInlineAddDraft((previous) => (previous ? { ...previous, [field]: value } : previous))
  }

  const syncInlineAddCategoryName = (value: string) => {
    const normalized = value.trim().toLowerCase()
    const match = activeCategories.find(
      (category) => category.userExpenseCategoryName.toLowerCase() === normalized,
    )
    setInlineAddDraft((previous) =>
      previous
        ? {
            ...previous,
            expenseCategoryName: value,
            expenseCategoryId: match ? String(match.userExpenseCategoryId) : '',
          }
        : previous,
    )
  }

  const inlineCategorySuggestions = useMemo(() => {
    if (!inlineAddDraft) return activeCategories
    const query = inlineAddDraft.expenseCategoryName.trim().toLowerCase()
    if (!query) return activeCategories
    return activeCategories.filter((category) =>
      category.userExpenseCategoryName.toLowerCase().includes(query),
    )
  }, [inlineAddDraft, activeCategories])

  const confirmInlineAdd = async () => {
    if (!session || !inlineAddDraft) return

    if (!inlineAddDraft.expenseName.trim()) {
      setStatus({ type: 'error', message: 'Please provide an expense name.' })
      return
    }
    let categoryIdToUse = inlineAddDraft.expenseCategoryId
    if (!categoryIdToUse || String(categoryIdToUse).trim() === '') {
      const name = (inlineAddDraft.expenseCategoryName ?? '').trim()
      if (name) {
        const matchActive = activeCategories.find(
          (c) => c.userExpenseCategoryName.trim().toLowerCase() === name.toLowerCase(),
        )
        if (matchActive) {
          categoryIdToUse = String(matchActive.userExpenseCategoryId)
        } else {
          const matchAll = expenseCategories.find(
            (c) => c.userExpenseCategoryName.trim().toLowerCase() === name.toLowerCase(),
          )
          if (matchAll) {
            categoryIdToUse = String(matchAll.userExpenseCategoryId)
          }
        }
      }
    }

    if (!categoryIdToUse || String(categoryIdToUse).trim() === '') {
      setStatus({ type: 'error', message: 'Please select an expense category.' })
      return
    }
    const numericAmount = parseAmount(inlineAddDraft.expenseAmount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setStatus({ type: 'error', message: 'Enter a valid amount greater than zero.' })
      return
    }
    if (!inlineAddDraft.expenseDate) {
      setStatus({ type: 'error', message: 'Please select a date.' })
      return
    }

    setStatus({ type: 'loading', message: 'Adding expense...' })
    try {
      await addExpense({
        userId: session.userId,
        userExpenseCategoryId: categoryIdToUse,
        expenseAmount: numericAmount,
        expenseDate: inlineAddDraft.expenseDate,
        expenseName: inlineAddDraft.expenseName,
      })
      setStatus({ type: 'success', message: 'Expense added.' })
      await refreshAfterMutation()
      cancelInlineAdd()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'adding expense') })
    }
  }

  const expenseSuggestions = useMemo(() => {
    const query = formState.expenseName.trim().toLowerCase()
    const unique = new Set<string>()
    expensesCache.forEach((expense) => {
      const candidate = (expense.expenseName ?? expense.description ?? '').trim()
      if (candidate.length === 0) return
      if (query && !candidate.toLowerCase().includes(query)) return
      unique.add(candidate)
    })
    return Array.from(unique).slice(0, 10)
  }, [formState.expenseName, expensesCache])

  const syncInlineCategoryName = (value: string) => {
    const normalized = value.trim().toLowerCase()
    const match = activeCategories.find(
      (category) => category.userExpenseCategoryName.toLowerCase() === normalized,
    )
    setEditingRowDraft((previous) =>
      previous
        ? {
            ...previous,
            expenseCategoryName: value,
            expenseCategoryId: match ? String(match.userExpenseCategoryId) : '',
          }
        : previous,
    )
  }

  const loadExpenses = async (mode: ViewMode, payload?: Record<string, unknown>, page: number = 0, size: number = pageSize) => {
    if (!session) return
    const userId = session.userId
    setLoading(true)
    setStatus({ type: 'loading', message: 'Fetching expenses...' })

    try {
      let response: PagedResponse<Expense>
      if (mode === 'month') {
        const monthPayload = payload as { month: number; year: number } | undefined
        const month = monthPayload?.month ?? selectedMonth
        const year = monthPayload?.year ?? selectedYear
        response = await fetchExpensesByMonth({ userId, month, year, page, size })
        setLastQuery({ mode, payload: { month, year } })
      } else if (mode === 'range') {
        const rangePayload = payload as { start: string; end: string } | undefined
        const start = rangePayload?.start ?? rangeStart
        const end = rangePayload?.end ?? rangeEnd
        if (!start || !end) {
          throw new Error('Please provide both start and end dates for range search.')
        }
        // enforce maximum range of 1 year (365 days)
        const from = new Date(start)
        const to = new Date(end)
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
          throw new Error('Invalid date provided for range.')
        }
        if (to < from) {
          throw new Error('End date must be the same or after start date.')
        }
        const diffDays = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays > 365) {
          throw new Error('Range cannot exceed 1 year.')
        }
        response = await fetchExpensesByRange({ userId, start, end, page, size })
        setLastQuery({ mode, payload: { start, end } })
      } else {
        // The backend will remove the 'fetch all' endpoint. Use month API as a safe default.
        const month = selectedMonth
        const year = selectedYear
        response = await fetchExpensesByMonth({ userId, month, year, page, size })
        setLastQuery({ mode: 'month', payload: { month, year } })
      }
      setResults(response.content)
      setCurrentPage(response.page)
      setTotalElements(response.totalElements)
      setTotalPages(response.totalPages)
      setStatus(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'fetching expenses') })
    } finally {
      setLoading(false)
    }
  }

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode)
  }

  // Toggle expanded row to show adjustments inline
  const toggleExpenseAdjustments = async (expenseId: string) => {
    const newExpanded = new Set(expandedExpenseIds)
    if (newExpanded.has(expenseId)) {
      newExpanded.delete(expenseId)
      setExpandedExpenseIds(newExpanded)
      return
    }
    
    newExpanded.add(expenseId)
    setExpandedExpenseIds(newExpanded)
    
    // Only fetch if not already cached
    if (!expenseAdjustmentsCache.has(expenseId) && session) {
      setLoadingAdjustments(prev => new Set(prev).add(expenseId))
      try {
        const adjustments = await fetchExpenseAdjustmentsByExpense(session.userId, expenseId)
        setExpenseAdjustmentsCache(prev => new Map(prev).set(expenseId, adjustments))
      } catch (error) {
        console.error('Failed to load adjustments for expense', expenseId, error)
        setExpenseAdjustmentsCache(prev => new Map(prev).set(expenseId, []))
      } finally {
        setLoadingAdjustments(prev => {
          const next = new Set(prev)
          next.delete(expenseId)
          return next
        })
      }
    }
  }

  // Open inline adjustment form for an expense
  const openAdjustmentForm = (expenseId: string) => {
    setShowAdjustmentForm(expenseId)
    setAdjustmentFormData({ adjustmentType: 'REFUND', adjustmentAmount: '', adjustmentReason: '' })
  }

  // Submit inline adjustment
  const submitInlineAdjustment = async (expense: Expense) => {
    if (!session) return
    const expenseId = expense.expensesId ?? expense.expenseId
    if (!expenseId) return
    
    const amount = parseFloat(adjustmentFormData.adjustmentAmount)
    const expenseAmount = Number(expense.amount ?? expense.expenseAmount)
    const existingAdjustments = expense.totalAdjustments ?? 0
    const totalAfterAdjustment = existingAdjustments + amount
    
    if (isNaN(amount) || amount <= 0) {
      setStatus({ type: 'error', message: 'Please enter a valid amount' })
      return
    }
    
    // Validate that adjustment amount doesn't exceed expense amount
    if (amount > expenseAmount) {
      setStatus({ type: 'error', message: `${adjustmentFormData.adjustmentType.charAt(0) + adjustmentFormData.adjustmentType.slice(1).toLowerCase()} amount cannot exceed expense amount (${formatCurrency(expenseAmount)})` })
      return
    }
    
    // Validate that total adjustments (existing + new) don't exceed expense amount
    if (totalAfterAdjustment > expenseAmount) {
      const remainingAllowed = expenseAmount - existingAdjustments
      setStatus({ 
        type: 'error', 
        message: `Total adjustments would exceed expense amount. Existing adjustments: ${formatCurrency(existingAdjustments)}. Maximum additional adjustment allowed: ${formatCurrency(remainingAllowed)}` 
      })
      return
    }
    
    setSavingAdjustment(true)
    try {
      // For guest users, keep the expenseId as string. For real users, convert to number.
      const isGuest = session.userId && guestStore.isGuestUser(session.userId)
      await createExpenseAdjustment({
        expensesId: isGuest ? expenseId : Number(expenseId),
        userId: session.userId,
        adjustmentType: adjustmentFormData.adjustmentType,
        adjustmentAmount: amount,
        adjustmentReason: adjustmentFormData.adjustmentReason || undefined,
        adjustmentDate: new Date().toISOString().split('T')[0],
        status: 'COMPLETED',
      })
      
      // Close form and reset state first
      setShowAdjustmentForm(null)
      setAdjustmentFormData({ adjustmentType: 'REFUND', adjustmentAmount: '', adjustmentReason: '' })
      // Exit edit mode after adding adjustment
      setEditingRowId(null)
      setEditingRowDraft(null)
      setEditingCategoryDropdownOpen(false)
      
      // Refresh data
      await refreshAfterMutation()
      // Invalidate adjustment cache for this expense
      setExpenseAdjustmentsCache(prev => {
        const next = new Map(prev)
        next.delete(String(expenseId))
        return next
      })
      
      // Show success notification after refresh
      setStatus({ type: 'success', message: `${adjustmentFormData.adjustmentType.charAt(0) + adjustmentFormData.adjustmentType.slice(1).toLowerCase()} added successfully` })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // Display backend validation errors directly if they relate to amount validation
      if (message.toLowerCase().includes('amount') || message.toLowerCase().includes('exceed') || message.toLowerCase().includes('adjustment')) {
        setStatus({ type: 'error', message })
      } else {
        setStatus({ type: 'error', message: friendlyErrorMessage(message, 'adding adjustment') })
      }
    } finally {
      setSavingAdjustment(false)
    }
  }

  const syncFormCategory = (value: string) => {
    const match = activeCategories.find(
      (category) => category.userExpenseCategoryName.toLowerCase() === value.toLowerCase(),
    )
    setFormState((previous) => ({
      ...previous,
      categoryName: match ? match.userExpenseCategoryName : value,
      expenseCategoryId: match ? String(match.userExpenseCategoryId) : '',
    }))
  }

  const resetForm = () => {
    setFormState(initialFormState)
    setCategoryDropdownOpen(false)
  }

  const refreshAfterMutation = async () => {
    if (!session) return
    await reloadExpensesCache(session.userId)
    if (lastQuery) {
      await loadExpenses(lastQuery.mode, lastQuery.payload, currentPage, pageSize)
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    if (lastQuery) {
      void loadExpenses(lastQuery.mode, lastQuery.payload, page, pageSize)
    }
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(0) // Reset to first page when page size changes
    if (lastQuery) {
      void loadExpenses(lastQuery.mode, lastQuery.payload, 0, size)
    }
  }

  const filteredResults = useMemo(() => {
    const nameQuery = tableFilters.expenseName.trim().toLowerCase()
    const categoryQuery = tableFilters.category.trim().toLowerCase()
    const amountQuery = tableFilters.amount.trim().toLowerCase()
    const dateQuery = tableFilters.date.trim().toLowerCase()

    if (!nameQuery && !categoryQuery && !amountQuery && !dateQuery) {
      return results
    }

    return results.filter((expense) => {
      const expenseName = (expense.expenseName ?? expense.description ?? '').toString().toLowerCase()
      const derivedCategoryName =
        extractExpenseCategoryName(expense as ExpenseWithUserCategory, activeCategories) || 'Uncategorised'
      const categoryName = derivedCategoryName.toLowerCase()

      const numericAmount = getAmount(expense)
      const amountString = Number.isFinite(numericAmount) ? numericAmount.toFixed(2) : ''
      const formattedAmount = formatCurrency(numericAmount).toLowerCase()

      const rawDate = (expense.expenseDate ?? '').toString().toLowerCase()
      const prettyDate = formatDate(expense.expenseDate).toLowerCase()

      if (nameQuery && !expenseName.includes(nameQuery)) {
        return false
      }
      if (categoryQuery && !categoryName.includes(categoryQuery)) {
        return false
      }
      if (amountQuery && !amountString.includes(amountQuery) && !formattedAmount.includes(amountQuery)) {
        return false
      }
      if (dateQuery && !rawDate.includes(dateQuery) && !prettyDate.includes(dateQuery)) {
        return false
      }

      return true
    })
  }, [results, tableFilters, activeCategories])

  const filtersApplied = useMemo(
    () => Object.values(tableFilters).some((value) => value.trim().length > 0),
    [tableFilters],
  )

  const startInlineEdit = (expense: Expense) => {
    const key = ensureId(expense)
    const derivedCategoryId = extractExpenseCategoryId(expense as ExpenseWithUserCategory)
      const derivedCategoryName =
        extractExpenseCategoryName(expense as ExpenseWithUserCategory, activeCategories) ||
      (derivedCategoryId ? '' : 'Uncategorised')

    setEditingRowId(key)
    setEditingRowDraft({
      expenseName: (expense.expenseName ?? expense.description ?? '').toString(),
      expenseCategoryId: derivedCategoryId,
      expenseCategoryName: derivedCategoryName,
      expenseAmount: String(expense.amount ?? expense.expenseAmount ?? ''),
      expenseDate: (expense.expenseDate ?? '').slice(0, 10),
    })
    setEditingCategoryDropdownOpen(false)
  }

  const cancelInlineEdit = () => {
    setEditingRowId(null)
    setEditingRowDraft(null)
    setEditingCategoryDropdownOpen(false)
    setShowAdjustmentForm(null)
    setAdjustmentFormData({ adjustmentType: 'REFUND', adjustmentAmount: '', adjustmentReason: '' })
  }

  const updateInlineDraft = (
    field: keyof InlineEditDraft,
    value: string,
  ) => {
    setEditingRowDraft((previous) => (previous ? { ...previous, [field]: value } : previous))
  }

  const confirmInlineEdit = async (expense: Expense) => {
    if (!session || !editingRowDraft) return
    const expensesId = expense.expensesId ?? expense.expenseId
    if (!expensesId) {
      setStatus({ type: 'error', message: 'Unable to update expense without identifier.' })
      return
    }

    const numericAmount = parseAmount(editingRowDraft.expenseAmount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setStatus({ type: 'error', message: 'Enter a valid amount greater than zero.' })
      return
    }
    let categoryIdToUse = editingRowDraft.expenseCategoryId
    if (!categoryIdToUse || String(categoryIdToUse).trim() === '') {
      // Attempt to resolve category id from the typed/derived category name so
      // users editing other fields don't need to re-select the category if
      // the draft contains the category name.
      const name = (editingRowDraft.expenseCategoryName ?? '').trim()
      if (name) {
        const matchActive = activeCategories.find(
          (c) => c.userExpenseCategoryName.trim().toLowerCase() === name.toLowerCase(),
        )
        if (matchActive) {
          categoryIdToUse = String(matchActive.userExpenseCategoryId)
        } else {
          // fallback to full category list from context (may include inactive ones)
          const matchAll = expenseCategories.find(
            (c) => c.userExpenseCategoryName.trim().toLowerCase() === name.toLowerCase(),
          )
          if (matchAll) {
            categoryIdToUse = String(matchAll.userExpenseCategoryId)
          }
        }
      }
    }

    if (!categoryIdToUse || String(categoryIdToUse).trim() === '') {
      setStatus({ type: 'error', message: 'Select a category before confirming.' })
      return
    }
    if (!editingRowDraft.expenseDate) {
      setStatus({ type: 'error', message: 'Select a date before confirming.' })
      return
    }

    setStatus({ type: 'loading', message: 'Updating expense...' })
    try {
      await updateExpense({
        expensesId,
        userId: session.userId,
        expenseAmount: numericAmount,
        expenseName: editingRowDraft.expenseName,
        expenseDate: editingRowDraft.expenseDate,
        userExpenseCategoryId: categoryIdToUse,
      })
      setStatus({ type: 'success', message: 'Expense updated.' })
      await refreshAfterMutation()
      cancelInlineEdit()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'updating expense') })
    }
  }

  const handleDelete = async (expense: Expense) => {
    if (!session) return
    const expensesId = expense.expensesId ?? expense.expenseId
    if (!expensesId) {
      setStatus({ type: 'error', message: 'Cannot delete expense without an identifier.' })
      return
    }
    const confirmed = window.confirm('Delete this expense?')
    if (!confirmed) return

    setStatus({ type: 'loading', message: 'Deleting expense...' })
    try {
      await deleteExpense({ userId: session.userId, expensesId })
      setStatus({ type: 'success', message: 'Expense deleted.' })
      if (editingRowId === ensureId(expense)) {
        cancelInlineEdit()
      }
      await refreshAfterMutation()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'deleting expense') })
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!session) return

    const { expenseCategoryId, amount, expenseDate, expenseName } = formState
    if (!expenseName.trim()) {
      setStatus({ type: 'error', message: 'Please provide an expense name.' })
      return
    }
    if (!expenseCategoryId) {
      setStatus({ type: 'error', message: 'Please select an expense category.' })
      return
    }
    const numericAmount = parseAmount(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setStatus({ type: 'error', message: 'Enter a valid amount greater than zero.' })
      return
    }
    if (!expenseDate) {
      setStatus({ type: 'error', message: 'Please select a date.' })
      return
    }

    setStatus({ type: 'loading', message: 'Adding expense...' })
    try {
      await addExpense({
        userId: session.userId,
        userExpenseCategoryId: expenseCategoryId,
        expenseAmount: numericAmount,
        expenseDate,
        expenseName,
      })
      setStatus({ type: 'success', message: 'Expense added.' })
      await refreshAfterMutation()
      resetForm()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'adding expense') })
    }
  }

  const totalAmount = useMemo(
    () => filteredResults.reduce((sum, expense) => sum + getAmount(expense), 0),
    [filteredResults],
  )

  const handleFilterChange = (field: keyof TableFilters, value: string) => {
    setTableFilters((previous) => ({ ...previous, [field]: value }))
  }

  const clearFilters = () => {
    setTableFilters({ expenseName: '', category: '', amount: '', date: '' })
  }

  return (
    <Grid container component="section" className={styles.page} spacing={3}>
      <Grid size={{ xs: 12, xl: 8 }}>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div className={styles.headerWithIcon}>
              <span className={styles.emojiIcon}>💸</span>
              <div>
                <Typography variant="h5" component="h2" className={styles.title}>
                  Expense Explorer
                </Typography>
                <Typography variant="body2" component="p" className={styles.subtitle}>
                  Review and manage expense entries.
                </Typography>
              </div>
            </div>
            <div className={styles.headerActions}>
              <span className={styles.badge}>{filteredResults.length} records</span>
              <button
                type="button"
                className={styles.exportButton}
                onClick={() => setExportModalOpen(true)}
                title="Export data"
              >
                <Download size={16} />
                Export
              </button>
            </div>
          </header>

          <form
            className={styles.filterRow}
            onSubmit={(event) => {
              event.preventDefault()
              setCurrentPage(0) // Reset to first page on new search
              void loadExpenses(viewMode, undefined, 0, pageSize)
            }}
          >
            <div className={styles.modeSelector}>
              <label className={styles.modeOption}>
                <input
                  type="radio"
                  name="viewMode"
                  value="month"
                  checked={viewMode === 'month'}
                  onChange={() => handleModeChange('month')}
                />
                <span>Month</span>
              </label>
              <label className={styles.modeOption}>
                <input
                  type="radio"
                  name="viewMode"
                  value="range"
                  checked={viewMode === 'range'}
                  onChange={() => handleModeChange('range')}
                />
                <span>Range</span>
              </label>
              {/* 'All' option removed — UI supports only Month and Range */}
            </div>

            {viewMode === 'month' && (
              <div className={styles.monthInputs}>
                <label className={styles.inlineField}>
                  <span>Month</span>
                  <select value={selectedMonth} onChange={(event) => setSelectedMonth(Number(event.target.value))}>
                    {MONTHS.map((label, index) => (
                      <option key={label} value={index + 1}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.inlineField}>
                  <span>Year</span>
                  <input
                    type="number"
                    value={selectedYear}
                    onChange={(event) => setSelectedYear(Number(event.target.value))}
                    min={2000}
                    max={2100}
                  />
                </label>
              </div>
            )}

            {viewMode === 'range' && (
              <div className={styles.rangeInputs}>
                <label className={styles.inlineField}>
                  <span>Start</span>
                  <input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
                </label>
                <label className={styles.inlineField}>
                  <span>End</span>
                  <input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
                </label>
              </div>
            )}

            <button className={styles.primaryButton} type="submit" disabled={loading}>
              <Search size={16} />
              {loading ? 'Loading…' : 'Load Expenses'}
            </button>
          </form>

          <div className={styles.tableContainer}>
            {results.length === 0 ? (
              loading ? (
                <div style={{padding:16}}>
                  {[0,1,2,3].map((i) => (
                    <div key={i} style={{display:'grid',gridTemplateColumns:'2fr 1fr 120px 120px 80px',gap:12,alignItems:'center',marginBottom:12}}>
                      <div><Skeleton /></div>
                      <div><Skeleton /></div>
                      <div><Skeleton /></div>
                      <div><Skeleton /></div>
                      <div><Skeleton /></div>
                    </div>
                  ))}
                </div>
              ) : (
                <Typography variant="body2" component="p" className={styles.placeholder}>
                  No expenses to display.
                </Typography>
              )
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Expense</th>
                    <th scope="col">Category</th>
                    <th scope="col" className={styles.numeric}>Amount</th>
                    <th scope="col" className={styles.date}>Date</th>
                    <th scope="col" className={styles.actions}>Actions</th>
                  </tr>
                  <tr className={styles.tableFilterRow}>
                    <th scope="col">
                      <input
                        className={styles.tableFilterInput}
                        type="search"
                        placeholder="Filter expense"
                        value={tableFilters.expenseName}
                        onChange={(event) => handleFilterChange('expenseName', event.target.value)}
                      />
                    </th>
                    <th scope="col">
                      <input
                        className={styles.tableFilterInput}
                        type="search"
                        placeholder="Filter category"
                        value={tableFilters.category}
                        onChange={(event) => handleFilterChange('category', event.target.value)}
                      />
                    </th>
                    <th scope="col">
                      <input
                        className={styles.tableFilterInput}
                        type="search"
                        placeholder="Filter amount"
                        value={tableFilters.amount}
                        onChange={(event) => handleFilterChange('amount', event.target.value)}
                      />
                    </th>
                    <th scope="col">
                      <input
                        className={styles.tableFilterInput}
                        type="search"
                        placeholder="Filter date"
                        value={tableFilters.date}
                        onChange={(event) => handleFilterChange('date', event.target.value)}
                      />
                    </th>
                    <th scope="col">
                      <div style={{display:'flex',gap:8,justifyContent:'center',alignItems:'center'}}>
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={() => (addingInline ? cancelInlineAdd() : beginInlineAdd())}
                        >
                          {addingInline ? 'Close' : 'Add Expense'}
                        </button>
                        {filtersApplied && (
                          <button type="button" onClick={clearFilters}>
                            Clear
                          </button>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {addingInline && inlineAddDraft && (
                    <tr key="__inline_add">
                      <td className={styles.date}>
                        <input
                          className={styles.inlineInput}
                          value={inlineAddDraft.expenseName}
                          onChange={(e) => updateInlineAddDraft('expenseName', e.target.value)}
                          placeholder="Expense"
                        />
                      </td>
                      <td>
                        <div className={styles.inlineDropdownField} ref={inlineCategoryFieldRef}>
                          <input
                            className={styles.inlineInput}
                            value={inlineAddDraft.expenseCategoryName}
                            onChange={(e) => {
                              setInlineCategoryDropdownOpen(true)
                              syncInlineAddCategoryName(e.target.value)
                            }}
                            onFocus={() => setInlineCategoryDropdownOpen(true)}
                            placeholder="Category"
                            autoComplete="off"
                          />
                          {inlineCategoryDropdownOpen && (
                            <ul className={styles.dropdownList} role="listbox">
                              {inlineCategorySuggestions.length === 0 ? (
                                <li className={styles.dropdownEmpty}>No categories found</li>
                              ) : (
                                inlineCategorySuggestions.map((category) => (
                                  <li
                                    key={category.userExpenseCategoryId}
                                    className={styles.dropdownItem}
                                    onMouseDown={(event) => {
                                      event.preventDefault()
                                      setInlineCategoryDropdownOpen(false)
                                      setInlineAddDraft((previous) =>
                                        previous
                                          ? {
                                              ...previous,
                                              expenseCategoryId: String(category.userExpenseCategoryId),
                                              expenseCategoryName: category.userExpenseCategoryName,
                                            }
                                          : previous,
                                      )
                                    }}
                                  >
                                    {category.userExpenseCategoryName}
                                  </li>
                                ))
                              )}
                            </ul>
                          )}
                        </div>
                      </td>
                      <td className={styles.numeric}>
                        <input
                          className={styles.inlineInput}
                          type="number"
                          min="0"
                          step="0.01"
                          value={inlineAddDraft.expenseAmount}
                          onChange={(e) => updateInlineAddDraft('expenseAmount', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.inlineInput}
                          type="date"
                          value={inlineAddDraft.expenseDate}
                          onChange={(e) => updateInlineAddDraft('expenseDate', e.target.value)}
                        />
                      </td>
                      <td className={styles.actions}>
                        <button type="button" onClick={() => void confirmInlineAdd()}>
                          Confirm
                        </button>
                        <button type="button" onClick={cancelInlineAdd}>
                          Cancel
                        </button>
                      </td>
                    </tr>
                  )}
                  {filteredResults.length === 0 ? (
                    <tr className={styles.emptyRow}>
                      <td colSpan={5}>No expenses match the current filters.</td>
                    </tr>
                  ) : (
                    filteredResults.map((expense) => {
                      const key = ensureId(expense)
                      const displayCategory =
                        extractExpenseCategoryName(expense as ExpenseWithUserCategory, activeCategories) ||
                        'Uncategorised'
                      const isEditing = editingRowId === key
                      const draft = isEditing ? editingRowDraft : null

                      return (
                        <React.Fragment key={key}>
                        <tr>
                          <td className={styles.date}>
                            {isEditing ? (
                              <input
                                className={styles.inlineInput}
                                value={draft?.expenseName ?? ''}
                                onChange={(event) => updateInlineDraft('expenseName', event.target.value)}
                                placeholder="Expense"
                              />
                            ) : (
                              <span className={styles.cellText}>{expense.expenseName ?? expense.description ?? '-'}</span>
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <div
                                className={styles.inlineDropdownField}
                                ref={isEditing ? inlineCategoryFieldRef : null}
                              >
                                <input
                                  className={styles.inlineInput}
                                  value={draft?.expenseCategoryName ?? ''}
                                  onChange={(event) => {
                                    setEditingCategoryDropdownOpen(true)
                                    syncInlineCategoryName(event.target.value)
                                  }}
                                  onFocus={() => setEditingCategoryDropdownOpen(true)}
                                  placeholder="Category"
                                  autoComplete="off"
                                />
                                {editingCategoryDropdownOpen && editingRowId === key && (
                                  <ul className={styles.dropdownList} role="listbox">
                                    {editingCategorySuggestions.length === 0 ? (
                                      <li className={styles.dropdownEmpty}>No categories found</li>
                                    ) : (
                                      editingCategorySuggestions.map((category) => (
                                        <li
                                          key={category.userExpenseCategoryId}
                                          className={styles.dropdownItem}
                                          onMouseDown={(event) => {
                                            event.preventDefault()
                                            setEditingCategoryDropdownOpen(false)
                                            setEditingRowDraft((previous) =>
                                              previous
                                                ? {
                                                    ...previous,
                                                    expenseCategoryId: String(category.userExpenseCategoryId),
                                                    expenseCategoryName: category.userExpenseCategoryName,
                                                  }
                                                : previous,
                                            )
                                          }}
                                        >
                                          {category.userExpenseCategoryName}
                                        </li>
                                      ))
                                    )}
                                  </ul>
                                )}
                              </div>
                            ) : (
                              <span className={styles.cellText}>{displayCategory}</span>
                            )}
                          </td>
                          <td className={styles.numeric}>
                            {isEditing ? (
                              <input
                                className={styles.inlineInput}
                                type="number"
                                min="0"
                                step="0.01"
                                value={draft?.expenseAmount ?? ''}
                                onChange={(event) => updateInlineDraft('expenseAmount', event.target.value)}
                              />
                            ) : expense.totalAdjustments && expense.totalAdjustments > 0 ? (
                              <div className={styles.amountWithAdjustment}>
                                <span className={styles.originalAmount}>{formatCurrency(Number(expense.amount ?? expense.expenseAmount))}</span>
                                <span className={styles.netAmount}>{formatCurrency(Number(expense.netExpenseAmount ?? expense.amount ?? expense.expenseAmount))}</span>
                                <div className={styles.adjustmentBadgeRow}>
                                  <span className={styles.adjustmentBadge} title="Has adjustments">
                                    -{formatCurrency(expense.totalAdjustments)}
                                  </span>
                                  <button
                                    type="button"
                                    className={styles.adjustmentToggleIcon}
                                    onClick={() => void toggleExpenseAdjustments(key)}
                                    title={expandedExpenseIds.has(key) ? 'Hide adjustments' : 'Show adjustments'}
                                  >
                                    {expandedExpenseIds.has(key) ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <span className={styles.cellText}>{formatCurrency(Number(expense.amount ?? expense.expenseAmount))}</span>
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className={styles.inlineInput}
                                type="date"
                                value={draft?.expenseDate ?? ''}
                                onChange={(event) => updateInlineDraft('expenseDate', event.target.value)}
                              />
                            ) : (
                              <span className={styles.cellText}>{formatDate(expense.expenseDate)}</span>
                            )}
                          </td>
                          <td className={styles.actions}>
                            {isEditing ? (
                              <>
                                <button type="button" onClick={() => void confirmInlineEdit(expense)}>
                                  Confirm
                                </button>
                                <button type="button" onClick={cancelInlineEdit}>
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className={styles.addAdjustmentBtn}
                                  onClick={() => openAdjustmentForm(key)}
                                  title="Add refund or cashback"
                                >
                                  <RefreshCcw size={14} />
                                  Add Refund/Cashback
                                </button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => startInlineEdit(expense)}>
                                  Edit
                                </button>
                                <button type="button" onClick={() => void handleDelete(expense)}>
                                  Delete
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                        {/* Inline adjustment form when adding refund/cashback */}
                        {showAdjustmentForm === key && (
                          <tr className={styles.adjustmentFormRow}>
                            <td colSpan={5}>
                              <div className={styles.inlineAdjustmentForm}>
                                <div className={styles.adjustmentFormHeader}>
                                  <RefreshCcw size={16} />
                                  <span>Add Refund/Cashback for "{expense.expenseName ?? expense.description}"</span>
                                </div>
                                <div className={styles.adjustmentFormFields}>
                                  <label className={styles.adjustmentFormField}>
                                    <span>Type</span>
                                    <select
                                      value={adjustmentFormData.adjustmentType}
                                      onChange={(e) => setAdjustmentFormData(prev => ({ ...prev, adjustmentType: e.target.value as AdjustmentType }))}
                                      disabled={savingAdjustment}
                                    >
                                      <option value="REFUND">Refund</option>
                                      <option value="CASHBACK">Cashback</option>
                                      <option value="REVERSAL">Reversal</option>
                                    </select>
                                  </label>
                                  <label className={styles.adjustmentFormField}>
                                    <span>Amount</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="0.00"
                                      value={adjustmentFormData.adjustmentAmount}
                                      onChange={(e) => setAdjustmentFormData(prev => ({ ...prev, adjustmentAmount: e.target.value }))}
                                      disabled={savingAdjustment}
                                    />
                                  </label>
                                  <label className={styles.adjustmentFormField}>
                                    <span>Reason (optional)</span>
                                    <input
                                      type="text"
                                      placeholder="e.g., Item returned"
                                      value={adjustmentFormData.adjustmentReason}
                                      onChange={(e) => setAdjustmentFormData(prev => ({ ...prev, adjustmentReason: e.target.value }))}
                                      disabled={savingAdjustment}
                                    />
                                  </label>
                                </div>
                                <div className={styles.adjustmentFormActions}>
                                  <button
                                    type="button"
                                    className={styles.adjustmentFormSave}
                                    onClick={() => void submitInlineAdjustment(expense)}
                                    disabled={savingAdjustment || !adjustmentFormData.adjustmentAmount}
                                  >
                                    {savingAdjustment ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.adjustmentFormCancel}
                                    onClick={() => {
                                      setShowAdjustmentForm(null)
                                      setEditingRowId(null)
                                      setEditingRowDraft(null)
                                      setEditingCategoryDropdownOpen(false)
                                    }}
                                    disabled={savingAdjustment}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        {/* Expandable row for adjustments */}
                        {expandedExpenseIds.has(key) && (
                          <tr className={styles.expandableRow}>
                            <td colSpan={5}>
                              <div className={styles.adjustmentDetailContainer}>
                                <div className={styles.adjustmentDetailHeader}>
                                  <span>Adjustments for "{expense.expenseName ?? expense.description}"</span>
                                </div>
                                {loadingAdjustments.has(key) ? (
                                  <div className={styles.adjustmentLoading}>Loading adjustments...</div>
                                ) : (expenseAdjustmentsCache.get(key) ?? []).length === 0 ? (
                                  <div className={styles.adjustmentEmpty}>No adjustment details available</div>
                                ) : (
                                  <table className={styles.adjustmentTable}>
                                    <thead>
                                      <tr>
                                        <th>Type</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th>Date</th>
                                        <th>Reason</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(expenseAdjustmentsCache.get(key) ?? []).map((adj) => (
                                        <tr key={adj.expenseAdjustmentsId}>
                                          <td>
                                            <span className={`${styles.adjustmentItemType} ${styles[`type${adj.adjustmentType}`]}`}>
                                              {adj.adjustmentType}
                                            </span>
                                          </td>
                                          <td className={styles.adjustmentItemAmount}>
                                            -{formatCurrency(adj.adjustmentAmount)}
                                          </td>
                                          <td>
                                            <span className={`${styles.adjustmentItemStatus} ${styles[`status${adj.status}`]}`}>
                                              {adj.status}
                                            </span>
                                          </td>
                                          <td className={styles.adjustmentItemDate}>
                                            {formatDate(adj.adjustmentDate)}
                                          </td>
                                          <td className={styles.adjustmentItemReason} title={adj.adjustmentReason ?? ''}>
                                            {adj.adjustmentReason || '-'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })
                )}
              </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Total</td>
                    <td className={styles.numeric}>
                      <span className={styles.totalPill}>{formatCurrency(totalAmount)}</span>
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalElements={totalElements}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            loading={loading}
          />

          
        </section>
      </Grid>
      <Grid size={{ xs: 12, xl: 4 }}>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div className={styles.headerWithIcon}>
              <span className={styles.emojiIcon}>➕</span>
              <div>
                <Typography variant="h5" component="h2" className={styles.title}>
                  Add Expense
                </Typography>
                <Typography variant="body2" component="p" className={styles.subtitle}>
                  Record a new expense entry.
                </Typography>
              </div>
            </div>
          </header>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span>Expense</span>
              <input
                list="expense-name-options"
                value={formState.expenseName}
                onChange={(event) => setFormState((previous) => ({ ...previous, expenseName: event.target.value }))}
                placeholder="What did you spend on?"
                autoComplete="off"
                required
              />
              <datalist id="expense-name-options">
                {expenseSuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </label>

            <label className={`${styles.field} ${styles.dropdownField}`} ref={categoryFieldRef}>
              <span>Category</span>
              <input
                type="text"
                value={formState.categoryName}
                placeholder="Select or search category"
                onChange={(event) => {
                  syncFormCategory(event.target.value)
                  setCategoryDropdownOpen(true)
                }}
                onFocus={() => setCategoryDropdownOpen(true)}
                onClick={() => setCategoryDropdownOpen(true)}
                autoComplete="off"
                required
              />
              {categoryDropdownOpen && (
                <ul className={styles.dropdownList} role="listbox">
                  {categorySuggestions.length === 0 ? (
                    <li className={styles.dropdownEmpty}>No categories found</li>
                  ) : (
                    categorySuggestions.map((category) => (
                      <li
                        key={category.userExpenseCategoryId}
                        className={styles.dropdownItem}
                        onMouseDown={(event) => {
                          event.preventDefault()
                          syncFormCategory(category.userExpenseCategoryName)
                          setCategoryDropdownOpen(false)
                        }}
                      >
                        {category.userExpenseCategoryName}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </label>

            <label className={styles.field}>
              <span>Amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formState.amount}
                onChange={(event) => setFormState((previous) => ({ ...previous, amount: event.target.value }))}
                required
              />
            </label>

            <label className={styles.field}>
              <span>Date</span>
              <input
                type="date"
                value={formState.expenseDate}
                onChange={(event) => setFormState((previous) => ({ ...previous, expenseDate: event.target.value }))}
                required
              />
            </label>

            <div className={styles.formActions}>
              <button className={styles.primaryButton} type="submit">
                Add Expense
              </button>
              <button className={styles.secondaryButton} type="button" onClick={resetForm}>
                Clear
              </button>
            </div>
          </form>
        </section>
      </Grid>

      {/* Export Modal */}
      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        defaultExportType="EXPENSES"
      />
    </Grid>
  )
}
