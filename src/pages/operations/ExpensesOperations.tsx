import Grid from '@mui/material/Grid'
import { Typography } from '@mui/material'
import React, { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react'
import ReactDOM from 'react-dom'
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
  Upload,
  RefreshCcw,
  Eye,
  EyeOff,
} from 'lucide-react'
import {
  addExpense,
  deleteExpense,
  fetchExpensesByMonth,
  fetchExpensesByRange,
  fetchExpenseTotalByMonth,
  fetchAnalyticsSummaryByRange,
  updateExpense,
  fetchExpenseAdjustmentsByExpense,
  createExpenseAdjustment,
} from '../../api'
import type { Expense, UserExpenseCategory, PagedResponse, ExpenseAdjustment, AdjustmentType, ExpenseServerParams } from '../../types/app'
import { useAppDataContext } from '../../context/AppDataContext'
import { formatDate, parseAmount, friendlyErrorMessage } from '../../utils/format'
import { FilterDropdown } from './FilterDropdown'
import { usePreferences } from '../../context/PreferencesContext'
import { guestStore } from '../../utils/guestStore'
import styles from './ExpensesOperations.module.css'
import Skeleton from '../../components/Skeleton'
import Pagination from '../../components/Pagination'
import ExportModal from '../../components/ExportModal'
import ImportStatementModal from '../../components/ImportStatementModal'

const DEFAULT_PAGE_SIZE = 20

type ViewMode = 'month' | 'range' | 'current-year' | 'last-year' | 'financial-year' | 'last-financial-year'

const VIEW_MODE_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'range', label: 'Range' },
  { value: 'current-year', label: 'Current Year' },
  { value: 'last-year', label: 'Last Year' },
  { value: 'financial-year', label: 'Financial Year' },
  { value: 'last-financial-year', label: 'Last Fin. Year' },
]

function getDateRangeForMode(mode: ViewMode): { start: string; end: string } | null {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  switch (mode) {
    case 'current-year':
      return { start: `${year}-01-01`, end: todayStr }
    case 'last-year': {
      const y = year - 1
      return { start: `${y}-01-01`, end: `${y}-12-31` }
    }
    case 'financial-year': {
      const fyStart = month >= 4 ? year : year - 1
      return { start: `${fyStart}-04-01`, end: `${fyStart + 1}-03-31` }
    }
    case 'last-financial-year': {
      const currFyStart = month >= 4 ? year : year - 1
      const lastFyStart = currFyStart - 1
      return { start: `${lastFyStart}-04-01`, end: `${lastFyStart + 1}-03-31` }
    }
    default:
      return null
  }
}

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
  amountOperator: 'contains' | 'gt' | 'lt'
  date: string
  dateFilterMode: 'contains' | 'month' | 'year'
  dateMonth: string
  dateYear: string
}

type SortConfig = {
  field: 'expenseName' | 'category' | 'amount' | 'date' | null
  direction: 'asc' | 'desc' | null
}

const EXPENSE_SORT_MAP: Record<NonNullable<SortConfig['field']>, ExpenseServerParams['sortBy']> = {
  expenseName: 'expenseName',
  category: 'categoryName',
  amount: 'expenseAmount',
  date: 'expenseDate',
}

function buildExpenseServerParams(filters: TableFilters, sort: SortConfig): ExpenseServerParams {
  const params: ExpenseServerParams = {}
  if (sort.field && sort.direction) {
    params.sortBy = EXPENSE_SORT_MAP[sort.field]
    params.sortDir = sort.direction.toUpperCase() as 'ASC' | 'DESC'
  }
  if (filters.expenseName.trim()) params.filterName = filters.expenseName.trim()
  if (filters.category.trim()) params.filterCategory = filters.category.trim()
  if (filters.amount.trim()) {
    const num = parseFloat(filters.amount)
    if (!isNaN(num) && num >= 0) {
      const opMap = { gt: 'GT', lt: 'LT', contains: 'EQ' } as const
      params.filterAmountOp = opMap[filters.amountOperator as keyof typeof opMap] ?? 'EQ'
      params.filterAmountValue = num
    }
  }
  if (filters.dateFilterMode === 'month' && filters.dateMonth) {
    params.filterDateType = 'Month'
    params.filterDateValue = filters.dateMonth
  } else if (filters.dateFilterMode === 'year' && filters.dateYear) {
    params.filterDateType = 'Year'
    params.filterDateValue = filters.dateYear
  } else if (filters.dateFilterMode === 'contains' && /^\d{4}-\d{2}-\d{2}$/.test(filters.date.trim())) {
    params.filterDateType = 'Date'
    params.filterDateValue = filters.date.trim()
  }
  return params
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

const sortExpensesByDateDesc = (expenses: Expense[]): Expense[] =>
  [...expenses].sort((a, b) => {
    const da = a.expenseDate ? new Date(a.expenseDate).getTime() : 0
    const db = b.expenseDate ? new Date(b.expenseDate).getTime() : 0
    return db - da
  })

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
  const [tableFilters, setTableFilters] = useState<TableFilters>({ expenseName: '', category: '', amount: '', amountOperator: 'contains', date: '', dateFilterMode: 'contains', dateMonth: '', dateYear: '' })
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: null, direction: null })
  const [pendingAmount, setPendingAmount] = useState<string>('')
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(0)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [totalElements, setTotalElements] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(1)
  // Export modal state
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false)
  const [exportModalDates, setExportModalDates] = useState<{ start?: string; end?: string }>({})
  // Import statement modal state
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false)
  // All-pages total (fetched from API when pagination is active)
  const [allPagesTotal, setAllPagesTotal] = useState<number | null>(null)
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
  const [adjustmentTypeDropdownOpen, setAdjustmentTypeDropdownOpen] = useState(false)
  const adjustmentTypeFieldRef = useRef<HTMLDivElement | null>(null)
  // Month dropdown state for view mode
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false)
  const monthDropdownRef = useRef<HTMLDivElement | null>(null)
  // View mode dropdown state
  const [viewModeDropdownOpen, setViewModeDropdownOpen] = useState(false)
  const viewModeDropdownBtnRef = useRef<HTMLButtonElement | null>(null)
  const viewModeDropdownMenuRef = useRef<HTMLUListElement | null>(null)

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
        setResults(sortExpensesByDateDesc(response.content))
        setCurrentPage(response.page)
        setTotalElements(response.totalElements)
        setTotalPages(response.totalPages)
        setLastQuery({ mode: 'month', payload: { month: defaultMonth, year: defaultYear } })
        setStatus(null)
        // Background fetch of all-pages total when paginated
        if (response.totalPages > 1) {
          const uid = session.userId
          const m = defaultMonth
          const y = defaultYear
          void (async () => {
            try {
              const total = await fetchExpenseTotalByMonth({ userId: uid, month: m, year: y })
              setAllPagesTotal(total)
            } catch {
              setAllPagesTotal(null)
            }
          })()
        }
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

  const inlineCategoryInputRef = useRef<HTMLInputElement | null>(null)
  const editingCategoryInputRef = useRef<HTMLInputElement | null>(null)
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

  // Close adjustment type dropdown when clicking outside
  useEffect(() => {
    if (!adjustmentTypeDropdownOpen) return

    const handleClickAway = (event: MouseEvent) => {
      if (adjustmentTypeFieldRef.current && !adjustmentTypeFieldRef.current.contains(event.target as Node)) {
        setAdjustmentTypeDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickAway)
    return () => {
      document.removeEventListener('mousedown', handleClickAway)
    }
  }, [adjustmentTypeDropdownOpen])

  // Close month dropdown when clicking outside
  useEffect(() => {
    if (!monthDropdownOpen) return

    const handleClickAway = (event: MouseEvent) => {
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) {
        setMonthDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickAway)
    return () => {
      document.removeEventListener('mousedown', handleClickAway)
    }
  }, [monthDropdownOpen])

  // Close view mode dropdown when clicking outside
  useEffect(() => {
    if (!viewModeDropdownOpen) return
    const handleClickAway = (event: MouseEvent) => {
      const target = event.target as Node
      if (viewModeDropdownBtnRef.current?.contains(target)) return
      if (viewModeDropdownMenuRef.current?.contains(target)) return
      setViewModeDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickAway)
    return () => document.removeEventListener('mousedown', handleClickAway)
  }, [viewModeDropdownOpen])

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

  const loadExpenses = async (mode: ViewMode, payload?: Record<string, unknown>, page: number = 0, size: number = pageSize, serverParams: ExpenseServerParams = {}) => {
    if (!session) return
    const userId = session.userId
    setLoading(true)
    setStatus({ type: 'loading', message: 'Fetching expenses...' })

    try {
      let response: PagedResponse<Expense>
      let resolvedMonth: number | undefined
      let resolvedYear: number | undefined
      let resolvedStart: string | undefined
      let resolvedEnd: string | undefined
      if (mode === 'month') {
        const monthPayload = payload as { month: number; year: number } | undefined
        resolvedMonth = monthPayload?.month ?? selectedMonth
        resolvedYear = monthPayload?.year ?? selectedYear
        response = await fetchExpensesByMonth({ userId, month: resolvedMonth, year: resolvedYear, page, size, ...serverParams })
        setLastQuery({ mode, payload: { month: resolvedMonth, year: resolvedYear } })
      } else if (mode === 'range') {
        const rangePayload = payload as { start: string; end: string } | undefined
        resolvedStart = rangePayload?.start ?? rangeStart
        resolvedEnd = rangePayload?.end ?? rangeEnd
        if (!resolvedStart || !resolvedEnd) {
          throw new Error('Please provide both start and end dates for range search.')
        }
        // enforce maximum range of 1 year (365 days)
        const from = new Date(resolvedStart)
        const to = new Date(resolvedEnd)
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
        response = await fetchExpensesByRange({ userId, start: resolvedStart, end: resolvedEnd, page, size, ...serverParams })
        setLastQuery({ mode, payload: { start: resolvedStart, end: resolvedEnd } })
      } else {
        // Fixed date-range modes: current-year, last-year, financial-year, last-financial-year
        const rangePayload = payload as { start: string; end: string } | undefined
        const computed = getDateRangeForMode(mode)
        resolvedStart = rangePayload?.start ?? computed?.start
        resolvedEnd = rangePayload?.end ?? computed?.end
        if (!resolvedStart || !resolvedEnd) {
          throw new Error('Could not compute date range for selected mode.')
        }
        response = await fetchExpensesByRange({ userId, start: resolvedStart, end: resolvedEnd, page, size, ...serverParams })
        setLastQuery({ mode, payload: { start: resolvedStart, end: resolvedEnd } })
      }
      // Preserve date-desc default order only when no explicit server sort is requested
      setResults(serverParams.sortBy ? response.content : sortExpensesByDateDesc(response.content))
      setCurrentPage(response.page)
      setTotalElements(response.totalElements)
      setTotalPages(response.totalPages)
      setStatus(null)
      // Background fetch of all-pages total when paginated
      if (response.totalPages > 1) {
        setAllPagesTotal(null)
        const uid = userId
        const rm = resolvedMonth
        const ry = resolvedYear
        const rs = resolvedStart
        const re = resolvedEnd
        void (async () => {
          try {
            let total: number
            if (mode === 'month' && rm !== undefined && ry !== undefined) {
              total = await fetchExpenseTotalByMonth({ userId: uid, month: rm, year: ry })
            } else if (rs && re) {
              const summary = await fetchAnalyticsSummaryByRange({ userId: uid, start: rs, end: re })
              total = summary.netExpenses ?? summary.totalExpenses
            } else {
              return
            }
            setAllPagesTotal(total)
          } catch {
            setAllPagesTotal(null)
          }
        })()
      } else {
        setAllPagesTotal(null)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'fetching expenses') })
    } finally {
      setLoading(false)
    }
  }

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    const range = getDateRangeForMode(mode)
    if (range) {
      setRangeStart(range.start)
      setRangeEnd(range.end)
    }
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
      const sp = buildExpenseServerParams(tableFilters, sortConfig)
      await loadExpenses(lastQuery.mode, lastQuery.payload, currentPage, pageSize, sp)
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    if (lastQuery) {
      const sp = buildExpenseServerParams(tableFilters, sortConfig)
      void loadExpenses(lastQuery.mode, lastQuery.payload, page, pageSize, sp)
    }
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(0) // Reset to first page when page size changes
    if (lastQuery) {
      const sp = buildExpenseServerParams(tableFilters, sortConfig)
      void loadExpenses(lastQuery.mode, lastQuery.payload, 0, size, sp)
    }
  }

  const filteredResults = useMemo(() => {
    const nameQuery = tableFilters.expenseName.trim().toLowerCase()
    const categoryQuery = tableFilters.category.trim().toLowerCase()
    const amountQuery = tableFilters.amount.trim()
    const dateQuery = tableFilters.date.trim().toLowerCase()
    const dateMonth = tableFilters.dateMonth.trim()
    const dateYear = tableFilters.dateYear.trim()

    const hasFilters = !!(nameQuery || categoryQuery || amountQuery || dateQuery || dateMonth || dateYear)

    // Server handles cross-page filtering; client-side filter here refines the current page
    const baseResults = results

    let filtered: Expense[]
    if (!hasFilters) {
      filtered = baseResults
    } else {
      filtered = baseResults.filter((expense) => {
        const expenseName = (expense.expenseName ?? expense.description ?? '').toString().toLowerCase()
        const derivedCategoryName =
          extractExpenseCategoryName(expense as ExpenseWithUserCategory, activeCategories) || 'Uncategorised'
        const categoryName = derivedCategoryName.toLowerCase()

        const numericAmount = getAmount(expense)
        const amountString = Number.isFinite(numericAmount) ? numericAmount.toFixed(2) : ''
        const formattedAmount = formatCurrency(numericAmount).toLowerCase()

        const rawDate = (expense.expenseDate ?? '').toString().toLowerCase()
        const prettyDate = formatDate(expense.expenseDate).toLowerCase()

        if (nameQuery && !expenseName.includes(nameQuery)) return false
        if (categoryQuery && !categoryName.includes(categoryQuery)) return false

        // Amount filter with operator
        if (amountQuery) {
          const filterNum = parseFloat(amountQuery)
          if (!isNaN(filterNum)) {
            if (tableFilters.amountOperator === 'gt' && numericAmount <= filterNum) return false
            if (tableFilters.amountOperator === 'lt' && numericAmount >= filterNum) return false
            if (tableFilters.amountOperator === 'contains' && !amountString.includes(amountQuery) && !formattedAmount.includes(amountQuery.toLowerCase())) return false
          } else if (!amountString.includes(amountQuery) && !formattedAmount.includes(amountQuery.toLowerCase())) {
            return false
          }
        }

        // Date filter based on mode
        if (tableFilters.dateFilterMode === 'month' && dateMonth) {
          const d = expense.expenseDate ? new Date(expense.expenseDate) : null
          const expMonth = d ? d.getMonth() + 1 : null
          if (expMonth === null || String(expMonth) !== dateMonth) return false
        } else if (tableFilters.dateFilterMode === 'year' && dateYear) {
          const d = expense.expenseDate ? new Date(expense.expenseDate) : null
          const expYear = d ? d.getFullYear() : null
          if (expYear === null || String(expYear) !== dateYear) return false
        } else if (tableFilters.dateFilterMode === 'contains' && dateQuery) {
          if (!rawDate.includes(dateQuery) && !prettyDate.includes(dateQuery)) return false
        }

        return true
      })
    }

    // Apply sorting
    if (sortConfig.field && sortConfig.direction) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: string | number = ''
        let bVal: string | number = ''
        switch (sortConfig.field) {
          case 'expenseName':
            aVal = (a.expenseName ?? a.description ?? '').toLowerCase()
            bVal = (b.expenseName ?? b.description ?? '').toLowerCase()
            break
          case 'category':
            aVal = (extractExpenseCategoryName(a as ExpenseWithUserCategory, activeCategories) || 'Uncategorised').toLowerCase()
            bVal = (extractExpenseCategoryName(b as ExpenseWithUserCategory, activeCategories) || 'Uncategorised').toLowerCase()
            break
          case 'amount':
            aVal = getAmount(a)
            bVal = getAmount(b)
            break
          case 'date':
            aVal = a.expenseDate ? new Date(a.expenseDate).getTime() : 0
            bVal = b.expenseDate ? new Date(b.expenseDate).getTime() : 0
            break
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [results, tableFilters, activeCategories, sortConfig])

  const filtersApplied = useMemo(
    () =>
      tableFilters.expenseName.trim().length > 0 ||
      tableFilters.category.trim().length > 0 ||
      tableFilters.amount.trim().length > 0 ||
      tableFilters.date.trim().length > 0 ||
      tableFilters.dateMonth.trim().length > 0 ||
      tableFilters.dateYear.trim().length > 0,
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

  const exportDateRange = useMemo<{ start: string; end: string } | null>(() => {
    if (!lastQuery) return null
    if (lastQuery.mode === 'month') {
      const p = lastQuery.payload as { month: number; year: number } | undefined
      if (!p) return null
      const lastDay = new Date(p.year, p.month, 0).getDate()
      const mm = String(p.month).padStart(2, '0')
      const dd = String(lastDay).padStart(2, '0')
      return { start: `${p.year}-${mm}-01`, end: `${p.year}-${mm}-${dd}` }
    }
    const p = lastQuery.payload as { start: string; end: string } | undefined
    if (!p) return null
    return { start: p.start, end: p.end }
  }, [lastQuery])

  const handleFilterChange = (field: keyof TableFilters, value: string) => {
    setTableFilters((previous) => ({ ...previous, [field]: value }))
  }

  const clearFilters = () => {
    const emptyFilters: TableFilters = { expenseName: '', category: '', amount: '', amountOperator: 'contains', date: '', dateFilterMode: 'contains', dateMonth: '', dateYear: '' }
    setTableFilters(emptyFilters)
    setPendingAmount('')
    setCurrentPage(0)
    if (lastQuery) {
      void loadExpenses(lastQuery.mode, lastQuery.payload, 0, pageSize, {})
    }
  }

  const handleSort = (field: NonNullable<SortConfig['field']>) => {
    const newSort: SortConfig = (() => {
      if (sortConfig.field !== field) return { field, direction: 'asc' }
      if (sortConfig.direction === 'asc') return { field, direction: 'desc' }
      return { field: null, direction: null }
    })()
    setSortConfig(newSort)
    setCurrentPage(0)
    if (lastQuery) {
      const sp = buildExpenseServerParams(tableFilters, newSort)
      void loadExpenses(lastQuery.mode, lastQuery.payload, 0, pageSize, sp)
    }
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
                onClick={() => setImportModalOpen(true)}
                title="Import HDFC bank statement"
              >
                <Upload size={16} />
                Import
              </button>
              <button
                type="button"
                className={styles.exportButton}
                onClick={() => { setExportModalDates({}); setExportModalOpen(true) }}
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
              const sp = buildExpenseServerParams(tableFilters, sortConfig)
              void loadExpenses(viewMode, undefined, 0, pageSize, sp)
            }}
          >
            <div className={styles.viewModeDropdown}>
              <button
                ref={viewModeDropdownBtnRef}
                type="button"
                className={styles.viewModeBtn}
                onClick={() => setViewModeDropdownOpen((o) => !o)}
              >
                <span>{VIEW_MODE_OPTIONS.find(o => o.value === viewMode)?.label ?? viewMode}</span>
                <ChevronDown size={14} />
              </button>
              {viewModeDropdownOpen && viewModeDropdownBtnRef.current && ReactDOM.createPortal(
                <ul
                  ref={viewModeDropdownMenuRef}
                  className={styles.viewModeMenu}
                  style={{
                    position: 'fixed',
                    top: viewModeDropdownBtnRef.current.getBoundingClientRect().bottom + 4,
                    left: viewModeDropdownBtnRef.current.getBoundingClientRect().left,
                    zIndex: 99999,
                    minWidth: viewModeDropdownBtnRef.current.getBoundingClientRect().width,
                  }}
                >
                  {VIEW_MODE_OPTIONS.map(opt => (
                    <li
                      key={opt.value}
                      className={`${styles.viewModeMenuItem}${viewMode === opt.value ? ` ${styles.viewModeMenuItemActive}` : ''}`}
                      onMouseDown={() => {
                        handleModeChange(opt.value)
                        setViewModeDropdownOpen(false)
                      }}
                    >
                      {opt.label}
                    </li>
                  ))}
                </ul>,
                document.body,
              )}
            </div>

            {viewMode === 'month' && (
              <div className={styles.monthInputs}>
                <label className={styles.inlineField}>
                  <span>Month</span>
                  <div ref={monthDropdownRef} style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className={styles.dropdownTrigger}
                      onClick={() => setMonthDropdownOpen((o) => !o)}
                    >
                      <span>{MONTHS[selectedMonth - 1]}</span>
                      <ChevronDown size={16} />
                    </button>
                    {monthDropdownOpen && ReactDOM.createPortal(
                      <ul
                        className={styles.dropdownList}
                        style={{
                          position: 'fixed',
                          top: monthDropdownRef.current ? monthDropdownRef.current.getBoundingClientRect().bottom + 4 : 0,
                          left: monthDropdownRef.current ? monthDropdownRef.current.getBoundingClientRect().left : 0,
                          zIndex: 99999,
                          minWidth: monthDropdownRef.current ? monthDropdownRef.current.getBoundingClientRect().width : 140,
                        }}
                      >
                        {MONTHS.map((label, index) => (
                          <li
                            key={label}
                            className={`${styles.dropdownItem} ${selectedMonth === index + 1 ? styles.dropdownItemActive : ''}`}
                            onMouseDown={() => {
                              setSelectedMonth(index + 1)
                              setMonthDropdownOpen(false)
                            }}
                          >
                            {label}
                          </li>
                        ))}
                      </ul>,
                      document.body,
                    )}
                  </div>
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
            {loading && results.length === 0 ? (
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
            ) : results.length === 0 ? (
              <Typography variant="body2" component="p" className={styles.placeholder}>
                {filtersApplied ? 'No expenses match the current filters.' : 'No expenses to display.'}
              </Typography>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSort('expenseName')}>
                      Expense{sortConfig.field === 'expenseName' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSort('category')}>
                      Category{sortConfig.field === 'category' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th scope="col" className={`${styles.numeric} ${styles.sortableHeader}`} onClick={() => handleSort('amount')}>
                      Amount{sortConfig.field === 'amount' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th scope="col" className={`${styles.date} ${styles.sortableHeader}`} onClick={() => handleSort('date')}>
                      Date{sortConfig.field === 'date' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th scope="col" className={styles.actions}>Actions</th>
                  </tr>
                  <tr className={styles.tableFilterRow}>
                    <th scope="col">
                      <div className={styles.filterCell}>
                        <input
                          className={styles.tableFilterInput}
                          type="search"
                          placeholder="Filter expense"
                          value={tableFilters.expenseName}
                          onChange={(event) => handleFilterChange('expenseName', event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              setCurrentPage(0)
                              if (lastQuery) void loadExpenses(lastQuery.mode, lastQuery.payload, 0, pageSize, buildExpenseServerParams(tableFilters, sortConfig))
                            }
                          }}
                        />
                        <button
                          type="button"
                          className={styles.filterSearchBtn}
                          onClick={() => {
                            setCurrentPage(0)
                            if (lastQuery) void loadExpenses(lastQuery.mode, lastQuery.payload, 0, pageSize, buildExpenseServerParams(tableFilters, sortConfig))
                          }}
                          title="Search"
                        ><Search size={13} /></button>
                      </div>
                    </th>
                    <th scope="col">
                      <div className={styles.filterCell}>
                        <input
                          className={styles.tableFilterInput}
                          type="search"
                          placeholder="Filter category"
                          value={tableFilters.category}
                          onChange={(event) => handleFilterChange('category', event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              setCurrentPage(0)
                              if (lastQuery) void loadExpenses(lastQuery.mode, lastQuery.payload, 0, pageSize, buildExpenseServerParams(tableFilters, sortConfig))
                            }
                          }}
                        />
                        <button
                          type="button"
                          className={styles.filterSearchBtn}
                          onClick={() => {
                            setCurrentPage(0)
                            if (lastQuery) void loadExpenses(lastQuery.mode, lastQuery.payload, 0, pageSize, buildExpenseServerParams(tableFilters, sortConfig))
                          }}
                          title="Search"
                        ><Search size={13} /></button>
                      </div>
                    </th>
                    <th scope="col">
                      <div className={styles.filterCell}>
                        <FilterDropdown
                          value={tableFilters.amountOperator}
                          options={[
                            { value: 'lt', label: '< Less than', triggerLabel: '<' },
                            { value: 'contains', label: '= Equals', triggerLabel: '=' },
                            { value: 'gt', label: '> Greater than', triggerLabel: '>' },
                          ]}
                          onChange={(v) => handleFilterChange('amountOperator', v)}
                        />
                        <input
                          className={styles.tableFilterInput}
                          type="number"
                          placeholder="Amount"
                          min="0"
                          step="0.01"
                          value={pendingAmount}
                          onChange={(event) => setPendingAmount(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              const newFilters = { ...tableFilters, amount: pendingAmount }
                              setTableFilters(newFilters)
                              setCurrentPage(0)
                              if (lastQuery) void loadExpenses(lastQuery.mode, lastQuery.payload, 0, pageSize, buildExpenseServerParams(newFilters, sortConfig))
                            }
                          }}
                        />
                        <button
                          type="button"
                          className={styles.filterSearchBtn}
                          onClick={() => {
                            const newFilters = { ...tableFilters, amount: pendingAmount }
                            setTableFilters(newFilters)
                            setCurrentPage(0)
                            if (lastQuery) void loadExpenses(lastQuery.mode, lastQuery.payload, 0, pageSize, buildExpenseServerParams(newFilters, sortConfig))
                          }}
                          title="Search"
                        ><Search size={13} /></button>
                      </div>
                    </th>
                    <th scope="col">
                      <div className={styles.filterCell}>
                        <FilterDropdown
                          value={tableFilters.dateFilterMode}
                          options={[
                            { value: 'contains', label: 'Date' },
                            { value: 'month', label: 'Month' },
                            { value: 'year', label: 'Year' },
                          ]}
                          onChange={(v) => {
                            const mode = v as 'contains' | 'month' | 'year';
                            let newFilters: TableFilters;
                            if (mode === 'contains') newFilters = { ...tableFilters, dateFilterMode: mode, dateMonth: '', dateYear: '' };
                            else if (mode === 'month') newFilters = { ...tableFilters, dateFilterMode: mode, date: '', dateYear: '' };
                            else newFilters = { ...tableFilters, dateFilterMode: mode, date: '', dateMonth: '' };
                            setTableFilters(newFilters);
                            setCurrentPage(0);
                            if (lastQuery) void loadExpenses(lastQuery.mode, lastQuery.payload, 0, pageSize, buildExpenseServerParams(newFilters, sortConfig));
                          }}
                        />
                        {tableFilters.dateFilterMode === 'contains' && (
                          <>
                            <input
                              className={styles.tableFilterInput}
                              type="search"
                              placeholder="Filter date"
                              value={tableFilters.date}
                              onChange={(event) => handleFilterChange('date', event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  setCurrentPage(0)
                                  if (lastQuery) void loadExpenses(lastQuery.mode, lastQuery.payload, 0, pageSize, buildExpenseServerParams(tableFilters, sortConfig))
                                }
                              }}
                            />
                            <button
                              type="button"
                              className={styles.filterSearchBtn}
                              onClick={() => {
                                setCurrentPage(0)
                                if (lastQuery) void loadExpenses(lastQuery.mode, lastQuery.payload, 0, pageSize, buildExpenseServerParams(tableFilters, sortConfig))
                              }}
                              title="Search"
                            ><Search size={13} /></button>
                          </>
                        )}
                        {tableFilters.dateFilterMode === 'month' && (
                          <FilterDropdown
                            value={tableFilters.dateMonth || ''}
                            options={[
                              { value: '', label: 'All months' },
                              ...MONTHS.map((m, i) => ({ value: String(i + 1), label: m })),
                            ]}
                            onChange={(v) => {
                              const newFilters = { ...tableFilters, dateMonth: v }
                              setTableFilters(newFilters)
                              setCurrentPage(0)
                              if (lastQuery) void loadExpenses(lastQuery.mode, lastQuery.payload, 0, pageSize, buildExpenseServerParams(newFilters, sortConfig))
                            }}
                          />
                        )}
                        {tableFilters.dateFilterMode === 'year' && (
                          <>
                            <input className={styles.tableFilterInput} type="number" placeholder="Year" min="2000" max="2100" value={tableFilters.dateYear}
                              onChange={(event) => handleFilterChange('dateYear', event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  setCurrentPage(0)
                                  if (lastQuery) void loadExpenses(lastQuery.mode, lastQuery.payload, 0, pageSize, buildExpenseServerParams(tableFilters, sortConfig))
                                }
                              }}
                            />
                            <button
                              type="button"
                              className={styles.filterSearchBtn}
                              onClick={() => {
                                setCurrentPage(0)
                                if (lastQuery) void loadExpenses(lastQuery.mode, lastQuery.payload, 0, pageSize, buildExpenseServerParams(tableFilters, sortConfig))
                              }}
                              title="Search"
                            ><Search size={13} /></button>
                          </>
                        )}
                      </div>
                    </th>
                    <th scope="col">
                      <div className={styles.filterActions}>
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={() => (addingInline ? cancelInlineAdd() : beginInlineAdd())}
                        >
                          {addingInline ? 'Close' : 'Add Expense'}
                        </button>
                        {filtersApplied && (
                          <button type="button" className={styles.clearFilterBtn} onClick={clearFilters} title="Clear all filters">
                            Clear Filters
                          </button>
                        )}
                        {sortConfig.field && (
                          <button type="button" className={styles.clearFilterBtn} onClick={() => {
                            const newSort: SortConfig = { field: null, direction: null }
                            setSortConfig(newSort)
                            setCurrentPage(0)
                            if (lastQuery) void loadExpenses(lastQuery.mode, lastQuery.payload, 0, pageSize, buildExpenseServerParams(tableFilters, newSort))
                          }} title="Clear sort">
                            Clear Sort
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
                            ref={inlineCategoryInputRef}
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
                          {inlineCategoryDropdownOpen && inlineCategoryInputRef.current && ReactDOM.createPortal(
                            <ul
                              className={styles.dropdownList}
                              role="listbox"
                              style={{
                                position: 'fixed',
                                top: inlineCategoryInputRef.current.getBoundingClientRect().bottom + 4,
                                left: inlineCategoryInputRef.current.getBoundingClientRect().left,
                                width: inlineCategoryInputRef.current.getBoundingClientRect().width,
                                minWidth: 0,
                                zIndex: 99999,
                              }}
                            >
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
                            </ul>,
                            document.body
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
                                  ref={isEditing ? editingCategoryInputRef : null}
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
                                {editingCategoryDropdownOpen && editingRowId === key && editingCategoryInputRef.current && ReactDOM.createPortal(
                                  <ul
                                    className={styles.dropdownList}
                                    role="listbox"
                                    style={{
                                      position: 'fixed',
                                      top: editingCategoryInputRef.current.getBoundingClientRect().bottom + 4,
                                      left: editingCategoryInputRef.current.getBoundingClientRect().left,
                                      width: editingCategoryInputRef.current.getBoundingClientRect().width,
                                      minWidth: 0,
                                      zIndex: 99999,
                                    }}
                                  >
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
                                  </ul>,
                                  document.body
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
                                  <div className={styles.adjustmentFormField}>
                                    <span>Type</span>
                                    <div className={styles.inlineDropdownField} ref={adjustmentTypeFieldRef}>
                                      <button
                                        type="button"
                                        className={styles.dropdownTrigger}
                                        onClick={() => setAdjustmentTypeDropdownOpen(!adjustmentTypeDropdownOpen)}
                                        disabled={savingAdjustment}
                                      >
                                        <span>{adjustmentFormData.adjustmentType === 'REFUND' ? 'Refund' : adjustmentFormData.adjustmentType === 'CASHBACK' ? 'Cashback' : 'Reversal'}</span>
                                        <ChevronDown size={14} />
                                      </button>
                                      {adjustmentTypeDropdownOpen && (
                                        <ul className={styles.dropdownList} role="listbox">
                                          {[
                                            { value: 'REFUND', label: 'Refund' },
                                            { value: 'CASHBACK', label: 'Cashback' },
                                            { value: 'REVERSAL', label: 'Reversal' },
                                          ].map((option) => (
                                            <li
                                              key={option.value}
                                              className={`${styles.dropdownItem} ${adjustmentFormData.adjustmentType === option.value ? styles.dropdownItemActive : ''}`}
                                              onMouseDown={(ev) => {
                                                ev.preventDefault()
                                                setAdjustmentFormData(prev => ({ ...prev, adjustmentType: option.value as AdjustmentType }))
                                                setAdjustmentTypeDropdownOpen(false)
                                              }}
                                            >
                                              {option.label}
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </div>
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
                                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
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
                                  </div>
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
                {totalPages > 1 ? (
                  <>
                    <tr>
                      <td colSpan={2}>Total expenses in this page</td>
                      <td className={styles.numeric}>
                        <span className={styles.totalPill}>{formatCurrency(totalAmount)}</span>
                      </td>
                      <td colSpan={2} />
                    </tr>
                    <tr>
                      <td colSpan={2}>Total (all pages)</td>
                      <td className={styles.numeric}>
                        {allPagesTotal !== null ? (
                          <span className={styles.totalPill}>{formatCurrency(allPagesTotal)}</span>
                        ) : (
                          <span className={styles.totalPill}>…</span>
                        )}
                      </td>
                      <td />
                      <td>
                        <button
                          type="button"
                          className={styles.exportButton}
                          onClick={() => { setExportModalDates(exportDateRange ?? {}); setExportModalOpen(true) }}
                          title="Export expenses for current selection"
                        >
                          <Download size={14} />
                          Export
                        </button>
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan={2}>Total</td>
                    <td className={styles.numeric}>
                      <span className={styles.totalPill}>{formatCurrency(totalAmount)}</span>
                    </td>
                    <td />
                    <td>
                      <button
                        type="button"
                        className={styles.exportButton}
                        onClick={() => { setExportModalDates(exportDateRange ?? {}); setExportModalOpen(true) }}
                        title="Export expenses for current selection"
                      >
                        <Download size={14} />
                        Export
                      </button>
                    </td>
                  </tr>
                )}
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
        defaultStartDate={exportModalDates.start}
        defaultEndDate={exportModalDates.end}
      />

      {/* Import Statement Modal */}
      <ImportStatementModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImported={() => void refreshAfterMutation()}
      />
    </Grid>
  )
}
