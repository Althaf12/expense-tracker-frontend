import Grid from '@mui/material/Grid'
import { Typography } from '@mui/material'
import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react'
import { useRef } from 'react'
import ReactDOM from 'react-dom'
import { 
  Search, 
  Plus, 
  Trash2, 
  Pencil, 
  Check, 
  X,
  Download,
  Upload,
  ChevronDown,
} from 'lucide-react'
import { addIncome, deleteIncome, fetchIncomeByMonth, fetchIncomeByRange, fetchIncomeByYear, updateIncome, fetchAnalyticsSummaryByMonth, fetchAnalyticsSummaryByRange, fetchAnalyticsSummaryByYear } from '../../api'
import type { Income, PagedResponse, IncomeServerParams } from '../../types/app'
import { useAppDataContext } from '../../context/AppDataContext'
import { formatDate, parseAmount, friendlyErrorMessage } from '../../utils/format'
import { FilterDropdown } from './FilterDropdown'
import { usePreferences } from '../../context/PreferencesContext'
import styles from './IncomeOperations.module.css'
import Skeleton from '../../components/Skeleton'
import Pagination from '../../components/Pagination'
import ExportModal from '../../components/ExportModal'
import ImportStatementModal from '../../components/ImportStatementModal'

const DEFAULT_PAGE_SIZE = 20

type IncomeViewMode = 'month' | 'year' | 'range' | 'current-year' | 'last-year' | 'financial-year' | 'last-financial-year'

const VIEW_MODE_OPTIONS: { value: IncomeViewMode; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'range', label: 'Range' },
  { value: 'current-year', label: 'Current Year' },
  { value: 'last-year', label: 'Last Year' },
  { value: 'financial-year', label: 'Financial Year' },
  { value: 'last-financial-year', label: 'Last Fin. Year' },
]

function getDateRangeForMode(mode: IncomeViewMode): { start: string; end: string } | null {
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

type IncomeFormState = {
  source: string
  amount: string
  receivedDate: string
}

type TableFilters = {
  source: string
  amount: string
  amountOperator: 'contains' | 'gt' | 'lt'
  date: string
  dateFilterMode: 'contains' | 'month' | 'year'
  dateMonth: string
  dateYear: string
  monthYear: string
}

type SortConfig = {
  field: 'source' | 'amount' | 'date' | 'monthYear' | null
  direction: 'asc' | 'desc' | null
}

const INCOME_SORT_MAP: Partial<Record<NonNullable<SortConfig['field']>, IncomeServerParams['sortBy']>> = {
  source: 'source',
  amount: 'amount',
  date: 'receivedDate',
  monthYear: 'receivedDate',
}

function buildIncomeServerParams(filters: TableFilters, sort: SortConfig): IncomeServerParams {
  const params: IncomeServerParams = {}
  if (sort.field && sort.direction) {
    params.sortBy = INCOME_SORT_MAP[sort.field]
    params.sortDir = sort.direction.toUpperCase() as 'ASC' | 'DESC'
  }
  if (filters.source.trim()) params.filterSource = filters.source.trim()
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

const initialForm: IncomeFormState = {
  source: '',
  amount: '',
  receivedDate: '',
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

const deriveMonthYear = (isoDate: string): { monthName: string; monthNumber: number; year: number } => {
  const parsed = new Date(isoDate)
  const monthNumber = parsed.getMonth() + 1
  const year = parsed.getFullYear()
  const monthName = MONTHS[monthNumber - 1] ?? ''
  return { monthName, monthNumber, year }
}

const ensureIncomeId = (income: Income): string =>
  String(income.incomeId ?? `${income.source ?? 'income'}-${income.receivedDate ?? ''}`)

// Helper to compute default month and year based on income preference
const getPreferredMonthYear = (preference: 'P' | 'C'): { month: number; year: number } => {
  const now = new Date()
  if (preference === 'P') {
    // Previous month
    const prevMonth = now.getMonth() // 0-indexed, so getMonth() gives previous month number (1-indexed)
    const year = prevMonth === 0 ? now.getFullYear() - 1 : now.getFullYear()
    const month = prevMonth === 0 ? 12 : prevMonth
    return { month, year }
  }
  // Current month
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

export default function IncomeOperations(): ReactElement {
  const {
    session,
    setStatus,
    incomesCache,
    reloadIncomesCache,
  } = useAppDataContext()
  const { formatCurrency, incomeMonth } = usePreferences()
  
  // Compute default month/year based on user preference
  const { month: defaultMonth, year: defaultYear } = useMemo(
    () => getPreferredMonthYear(incomeMonth),
    [incomeMonth]
  )

  const [viewMode, setViewMode] = useState<IncomeViewMode>('month')
  const [results, setResults] = useState<Income[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [formState, setFormState] = useState<IncomeFormState>(initialForm)
  const [lastQuery, setLastQuery] = useState<{ mode: IncomeViewMode; payload?: Record<string, unknown> } | null>(null)
  const [monthFilter, setMonthFilter] = useState<number>(defaultMonth)
  const [yearFilter, setYearFilter] = useState<number>(defaultYear)
  const [yearOnlyYear, setYearOnlyYear] = useState<number>(new Date().getFullYear())
  const [rangeStart, setRangeStart] = useState<string>('')
  const [rangeEnd, setRangeEnd] = useState<string>('')
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingRowDraft, setEditingRowDraft] = useState<IncomeFormState | null>(null)
  const [tableFilters, setTableFilters] = useState<TableFilters>({
    source: '',
    amount: '',
    amountOperator: 'contains',
    date: '',
    dateFilterMode: 'contains',
    dateMonth: '',
    dateYear: '',
    monthYear: '',
  })
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: null, direction: null })
  const [pendingAmount, setPendingAmount] = useState<string>('')
  const [addingInline, setAddingInline] = useState<boolean>(false)
  const [inlineAddDraft, setInlineAddDraft] = useState<IncomeFormState | null>(null)
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(0)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [totalElements, setTotalElements] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(1)
  const initialLoadRef = useRef<boolean>(false)
  // Export modal state
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false)
  const [exportModalDates, setExportModalDates] = useState<{ start?: string; end?: string }>({})
  // Submission / action state to prevent duplicate clicks
  const [addingIncome, setAddingIncome] = useState(false)
  const [savingInlineAdd, setSavingInlineAdd] = useState(false)
  const [savingInlineEdit, setSavingInlineEdit] = useState(false)
  const [deletingIncomeIds, setDeletingIncomeIds] = useState<Set<string>>(new Set())
  // Import statement modal state
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false)
  // All-pages total (fetched from API when pagination is active)
  const [allPagesTotal, setAllPagesTotal] = useState<number | null>(null)
  // Month dropdown state
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false)
  const monthDropdownRef = useRef<HTMLDivElement>(null)
  // View mode dropdown state
  const [viewModeDropdownOpen, setViewModeDropdownOpen] = useState(false)
  const viewModeDropdownBtnRef = useRef<HTMLButtonElement | null>(null)
  const viewModeDropdownMenuRef = useRef<HTMLUListElement | null>(null)

  useEffect(() => {
    if (!session) return
    if (initialLoadRef.current) return
    initialLoadRef.current = true
    // Load income for the preferred month based on user preference
    void loadIncomes('month', { month: defaultMonth, year: defaultYear }, 0, DEFAULT_PAGE_SIZE)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, defaultMonth, defaultYear])

  // Click outside to close month dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(target)) {
        setMonthDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const handleModeChange = (mode: IncomeViewMode) => {
    setViewMode(mode)
    const range = getDateRangeForMode(mode)
    if (range) {
      setRangeStart(range.start)
      setRangeEnd(range.end)
    }
  }

  const sourceSuggestions = useMemo(() => {
    const query = formState.source.trim().toLowerCase()
    const unique = new Set<string>()
    incomesCache.forEach((income) => {
      const source = (income.source ?? '').trim()
      if (!source) return
      if (query && !source.toLowerCase().includes(query)) return
      unique.add(source)
    })
    return Array.from(unique).slice(0, 10)
  }, [formState.source, incomesCache])

  const loadIncomes = async (mode: IncomeViewMode, payload?: Record<string, unknown>, page: number = 0, size: number = pageSize, serverParams: IncomeServerParams = {}) => {
    if (!session) return
    const userId = session.userId
    setLoading(true)
    setStatus({ type: 'loading', message: 'Fetching income records...' })
    try {
      let response: PagedResponse<Income>
      let resolvedYear: number | undefined
      let resolvedMonth: number | undefined
      let resolvedStart: string | undefined
      let resolvedEnd: string | undefined
      if (mode === 'current-year') {
        resolvedYear = new Date().getFullYear()
        response = await fetchIncomeByRange({
          userId,
          fromMonth: '01',
          fromYear: String(resolvedYear),
          toMonth: '12',
          toYear: String(resolvedYear),
          page,
          size,
          ...serverParams,
        })
        setLastQuery({ mode })
      } else if (mode === 'month') {
        const monthPayload = payload as { month: number; year: number } | undefined
        resolvedMonth = monthPayload?.month ?? monthFilter
        resolvedYear = monthPayload?.year ?? yearFilter
        response = await fetchIncomeByMonth({ userId, month: resolvedMonth, year: resolvedYear, page, size, ...serverParams })
        setLastQuery({ mode, payload: { month: resolvedMonth, year: resolvedYear } })
      } else if (mode === 'year') {
        const yearPayload = payload as { year: number } | undefined
        resolvedYear = yearPayload?.year ?? yearOnlyYear
        response = await fetchIncomeByYear({ userId, year: resolvedYear, page, size, ...serverParams })
        setLastQuery({ mode, payload: { year: resolvedYear } })
      } else if (mode === 'range') {
        const rangePayload = payload as { start: string; end: string } | undefined
        resolvedStart = rangePayload?.start ?? rangeStart
        resolvedEnd = rangePayload?.end ?? rangeEnd
        if (!resolvedStart || !resolvedEnd) {
          throw new Error('Provide both start and end dates to fetch by range.')
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
        response = await fetchIncomeByRange({ userId, fromMonth: resolvedStart.slice(5, 7), fromYear: resolvedStart.slice(0, 4), toMonth: resolvedEnd.slice(5, 7), toYear: resolvedEnd.slice(0, 4), page, size, ...serverParams })
        setLastQuery({ mode, payload: { start: resolvedStart, end: resolvedEnd } })
      } else {
        // Fixed date-range modes: last-year, financial-year, last-financial-year
        const rangePayload = payload as { start: string; end: string } | undefined
        const computed = getDateRangeForMode(mode)
        resolvedStart = rangePayload?.start ?? computed?.start
        resolvedEnd = rangePayload?.end ?? computed?.end
        if (!resolvedStart || !resolvedEnd) {
          throw new Error('Could not compute date range for selected mode.')
        }
        response = await fetchIncomeByRange({ userId, fromMonth: resolvedStart.slice(5, 7), fromYear: resolvedStart.slice(0, 4), toMonth: resolvedEnd.slice(5, 7), toYear: resolvedEnd.slice(0, 4), page, size, ...serverParams })
        setLastQuery({ mode, payload: { start: resolvedStart, end: resolvedEnd } })
      }
      setResults(serverParams.sortBy ? response.content : response.content)
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
              const summary = await fetchAnalyticsSummaryByMonth({ userId: uid, year: ry, month: rm })
              total = summary.totalIncome
            } else if (mode === 'year' && ry !== undefined) {
              const summary = await fetchAnalyticsSummaryByYear({ userId: uid, year: ry })
              total = summary.totalIncome
            } else if (rs && re) {
              const summary = await fetchAnalyticsSummaryByRange({ userId: uid, start: rs, end: re })
              total = summary.totalIncome
            } else if (mode === 'current-year' && ry !== undefined) {
              const summary = await fetchAnalyticsSummaryByYear({ userId: uid, year: ry })
              total = summary.totalIncome
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
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'fetching income records') })
    } finally {
      setLoading(false)
    }
  }

  const filteredResults = useMemo(() => {
    const sourceQuery = tableFilters.source.trim().toLowerCase()
    const amountQuery = tableFilters.amount.trim()
    const dateQuery = tableFilters.date.trim().toLowerCase()
    const dateMonth = tableFilters.dateMonth.trim()
    const dateYear = tableFilters.dateYear.trim()
    const monthYearQuery = tableFilters.monthYear.trim().toLowerCase()

    const hasFilters = !!(sourceQuery || amountQuery || dateQuery || dateMonth || dateYear || monthYearQuery)

    // Use all-pages data when available and filters are active
    // Server handles cross-page filtering; client-side filter here refines the current page
    const baseResults = results

    let filtered: Income[]
    if (!hasFilters) {
      filtered = baseResults
    } else {
      filtered = baseResults.filter((income) => {
        const sourceValue = (income.source ?? '').toString().toLowerCase()

        const numericAmount = typeof income.amount === 'number' ? income.amount : Number(income.amount ?? 0)
        const amountString = Number.isFinite(numericAmount) ? numericAmount.toFixed(2) : ''
        const formattedAmount = formatCurrency(numericAmount).toLowerCase()

        const rawDate = (income.receivedDate ?? '').toString().toLowerCase()
        const formattedDate = formatDate(income.receivedDate).toLowerCase()

        const derived = income.receivedDate ? deriveMonthYear(String(income.receivedDate)) : null
        const normalizedMonth =
          typeof income.month === 'number' ? MONTHS[income.month - 1] ?? String(income.month) : income.month
        const monthDisplay = (normalizedMonth ?? derived?.monthName ?? '').toString().toLowerCase()
        const yearDisplay = String(income.year ?? derived?.year ?? '').toLowerCase()
        const monthYearDisplay = `${monthDisplay}, ${yearDisplay}`.toLowerCase()

        if (sourceQuery && !sourceValue.includes(sourceQuery)) return false

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
          const d = income.receivedDate ? new Date(income.receivedDate) : null
          const expMonth = d ? d.getMonth() + 1 : null
          if (expMonth === null || String(expMonth) !== dateMonth) return false
        } else if (tableFilters.dateFilterMode === 'year' && dateYear) {
          const d = income.receivedDate ? new Date(income.receivedDate) : null
          const expYear = d ? d.getFullYear() : null
          if (expYear === null || String(expYear) !== dateYear) return false
        } else if (tableFilters.dateFilterMode === 'contains' && dateQuery) {
          if (!rawDate.includes(dateQuery) && !formattedDate.includes(dateQuery)) return false
        }

        if (monthYearQuery && !monthYearDisplay.includes(monthYearQuery)) return false

        return true
      })
    }

    // Apply sorting
    if (sortConfig.field && sortConfig.direction) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: string | number = ''
        let bVal: string | number = ''
        switch (sortConfig.field) {
          case 'source':
            aVal = (a.source ?? '').toLowerCase()
            bVal = (b.source ?? '').toLowerCase()
            break
          case 'amount':
            aVal = typeof a.amount === 'number' ? a.amount : Number(a.amount ?? 0)
            bVal = typeof b.amount === 'number' ? b.amount : Number(b.amount ?? 0)
            break
          case 'date':
            aVal = a.receivedDate ? new Date(a.receivedDate).getTime() : 0
            bVal = b.receivedDate ? new Date(b.receivedDate).getTime() : 0
            break
          case 'monthYear': {
            const da = a.receivedDate ? deriveMonthYear(String(a.receivedDate)) : null
            const db = b.receivedDate ? deriveMonthYear(String(b.receivedDate)) : null
            aVal = da ? da.year * 100 + da.monthNumber : 0
            bVal = db ? db.year * 100 + db.monthNumber : 0
            break
          }
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [results, tableFilters, sortConfig])

  const filtersApplied = useMemo(
    () =>
      tableFilters.source.trim().length > 0 ||
      tableFilters.amount.trim().length > 0 ||
      tableFilters.date.trim().length > 0 ||
      tableFilters.dateMonth.trim().length > 0 ||
      tableFilters.dateYear.trim().length > 0 ||
      tableFilters.monthYear.trim().length > 0,
    [tableFilters],
  )

  const startInlineEdit = (income: Income) => {
    const key = ensureIncomeId(income)
    setEditingRowId(key)
    setEditingRowDraft({
      source: income.source ?? '',
      amount: String(income.amount ?? ''),
      receivedDate: (income.receivedDate ?? '').slice(0, 10),
    })
  }

  const cancelInlineEdit = () => {
    setEditingRowId(null)
    setEditingRowDraft(null)
  }

  const updateInlineDraft = (field: keyof IncomeFormState, value: string) => {
    setEditingRowDraft((previous) => (previous ? { ...previous, [field]: value } : previous))
  }

  const confirmInlineEdit = async (income: Income) => {
    if (!session || !editingRowDraft) return
    if (savingInlineEdit) return
    const incomeId = income.incomeId
    if (!incomeId) {
      setStatus({ type: 'error', message: 'Unable to update income without identifier.' })
      return
    }

    if (!editingRowDraft.source.trim()) {
      setStatus({ type: 'error', message: 'Provide an income source.' })
      return
    }
    const numericAmount = parseAmount(editingRowDraft.amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setStatus({ type: 'error', message: 'Provide a valid income amount.' })
      return
    }
    if (!editingRowDraft.receivedDate) {
      setStatus({ type: 'error', message: 'Select a received date.' })
      return
    }

  const { monthName, monthNumber, year } = deriveMonthYear(editingRowDraft.receivedDate)

    setSavingInlineEdit(true)
    setStatus({ type: 'loading', message: 'Updating income...' })
    try {
      await updateIncome({
        incomeId,
        userId: session.userId,
        source: editingRowDraft.source,
        amount: numericAmount,
        receivedDate: editingRowDraft.receivedDate,
        month: monthName || monthNumber,
        year,
      })
      setStatus({ type: 'success', message: 'Income updated.' })
      await reloadIncomesCache(session.userId)
      if (lastQuery) {
        await loadIncomes(lastQuery.mode, lastQuery.payload, currentPage, pageSize)
      }
      cancelInlineEdit()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'updating income') })
    } finally {
      setSavingInlineEdit(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!session) return
    if (addingIncome) return
    const { source, amount, receivedDate } = formState
    if (!source.trim()) {
      setStatus({ type: 'error', message: 'Provide an income source.' })
      return
    }
    const numericAmount = parseAmount(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setStatus({ type: 'error', message: 'Provide a valid income amount.' })
      return
    }
    if (!receivedDate) {
      setStatus({ type: 'error', message: 'Select a received date.' })
      return
    }

    const { monthName, monthNumber, year } = deriveMonthYear(receivedDate)
    setAddingIncome(true)
    setStatus({ type: 'loading', message: 'Adding income...' })
    try {
      await addIncome({
        userId: session.userId,
        source,
        amount: numericAmount,
        receivedDate,
        month: monthName,
        year,
      })
      setStatus({ type: 'success', message: 'Income added.' })
      await reloadIncomesCache(session.userId)
      if (lastQuery) {
        await loadIncomes(lastQuery.mode, lastQuery.payload, currentPage, pageSize)
      }
      setFormState(initialForm)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'adding income') })
    } finally {
      setAddingIncome(false)
    }
  }

  const beginInlineAdd = () => {
    setAddingInline(true)
    setInlineAddDraft({ source: '', amount: '', receivedDate: new Date().toISOString().slice(0, 10) })
    setEditingRowId(null)
  }

  const cancelInlineAdd = () => {
    setAddingInline(false)
    setInlineAddDraft(null)
  }

  const updateInlineAddDraft = (field: keyof IncomeFormState, value: string) => {
    setInlineAddDraft((previous) => (previous ? { ...previous, [field]: value } : previous))
  }

  const confirmInlineAdd = async () => {
    if (!session || !inlineAddDraft) return
    if (savingInlineAdd) return
    const { source, amount, receivedDate } = inlineAddDraft
    if (!source.trim()) {
      setStatus({ type: 'error', message: 'Provide an income source.' })
      return
    }
    const numericAmount = parseAmount(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setStatus({ type: 'error', message: 'Provide a valid income amount.' })
      return
    }
    if (!receivedDate) {
      setStatus({ type: 'error', message: 'Select a received date.' })
      return
    }
    const { monthName, monthNumber, year } = deriveMonthYear(receivedDate)
    setSavingInlineAdd(true)
    setStatus({ type: 'loading', message: 'Adding income...' })
    try {
      await addIncome({
        userId: session.userId,
        source,
        amount: numericAmount,
        receivedDate,
        month: monthName,
        year,
      })
      setStatus({ type: 'success', message: 'Income added.' })
      await reloadIncomesCache(session.userId)
      if (lastQuery) {
        await loadIncomes(lastQuery.mode, lastQuery.payload, currentPage, pageSize)
      }
      cancelInlineAdd()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'adding income') })
    } finally {
      setSavingInlineAdd(false)
    }
  }

  const handleDelete = async (income: Income) => {
    if (!session) return
    if (!income.incomeId) {
      setStatus({ type: 'error', message: 'Cannot delete income without identifier.' })
      return
    }
    const rowKey = ensureIncomeId(income)
    if (deletingIncomeIds.has(rowKey)) return
    const confirmed = window.confirm('Delete this income entry?')
    if (!confirmed) return

    setDeletingIncomeIds((prev) => new Set(prev).add(rowKey))
    setStatus({ type: 'loading', message: 'Deleting income...' })
    try {
      await deleteIncome({ userId: session.userId, incomeId: income.incomeId })
      setStatus({ type: 'success', message: 'Income deleted.' })
      if (editingRowId === rowKey) {
        cancelInlineEdit()
      }
      await reloadIncomesCache(session.userId)
      if (lastQuery) {
        await loadIncomes(lastQuery.mode, lastQuery.payload, currentPage, pageSize)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'deleting income') })
    } finally {
      setDeletingIncomeIds((prev) => {
        const next = new Set(prev)
        next.delete(rowKey)
        return next
      })
    }
  }

  const totalIncome = useMemo(
    () =>
      filteredResults.reduce(
        (sum, income) => sum + (typeof income.amount === 'number' ? income.amount : Number(income.amount ?? 0)),
        0,
      ),
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
    if (lastQuery.mode === 'current-year') {
      // May have payload (new format) or not (old format)
      const p = lastQuery.payload as { start: string; end: string } | undefined
      if (p) return { start: p.start, end: p.end }
      const y = new Date().getFullYear()
      return { start: `${y}-01-01`, end: `${y}-12-31` }
    }
    // All other modes: range, last-year, financial-year, last-financial-year
    const p = lastQuery.payload as { start: string; end: string } | undefined
    if (!p) return null
    return { start: p.start, end: p.end }
  }, [lastQuery])

  const handleFilterChange = (field: keyof TableFilters, value: string) => {
    setTableFilters((previous) => ({ ...previous, [field]: value }))
  }

  const clearFilters = () => {
    const emptyFilters = { source: '', amount: '', amountOperator: 'contains' as const, date: '', dateFilterMode: 'contains' as const, dateMonth: '', dateYear: '', monthYear: '' }
    setTableFilters(emptyFilters)
    setPendingAmount('')
    setCurrentPage(0)
    if (lastQuery) {
      void loadIncomes(lastQuery.mode, lastQuery.payload, 0, pageSize, {})
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
      const sp = buildIncomeServerParams(tableFilters, newSort)
      void loadIncomes(lastQuery.mode, lastQuery.payload, 0, pageSize, sp)
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    if (lastQuery) {
      const sp = buildIncomeServerParams(tableFilters, sortConfig)
      void loadIncomes(lastQuery.mode, lastQuery.payload, page, pageSize, sp)
    }
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(0) // Reset to first page when page size changes
    if (lastQuery) {
      const sp = buildIncomeServerParams(tableFilters, sortConfig)
      void loadIncomes(lastQuery.mode, lastQuery.payload, 0, size, sp)
    }
  }

  return (
    <Grid container component="section" className={styles.page} spacing={3}>
      <Grid size={{ xs: 12, xl: 8 }}>
        <section className={`${styles.card} ${styles.cardWithDropdown}`}>
          <header className={styles.cardHeader}>
            <div className={styles.headerWithIcon}>
              <span className={styles.emojiIcon}>💰</span>
              <div>
                <Typography variant="h5" component="h2" className={styles.title}>
                  Income Overview
                </Typography>
                <Typography variant="body2" component="p" className={styles.subtitle}>
                  Review and manage income entries.
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
              const sp = buildIncomeServerParams(tableFilters, sortConfig)
              void loadIncomes(viewMode, undefined, 0, pageSize, sp)
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
                <label>
                  <span>Month</span>
                  <div ref={monthDropdownRef} style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className={styles.dropdownTrigger}
                      onClick={() => setMonthDropdownOpen((o) => !o)}
                    >
                      <span>{MONTHS[monthFilter - 1]}</span>
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
                        {MONTHS.map((monthName, index) => (
                          <li
                            key={monthName}
                            className={`${styles.dropdownItem} ${monthFilter === index + 1 ? styles.dropdownItemActive : ''}`}
                            onMouseDown={() => {
                              setMonthFilter(index + 1)
                              setMonthDropdownOpen(false)
                            }}
                          >
                            {monthName}
                          </li>
                        ))}
                      </ul>,
                      document.body,
                    )}
                  </div>
                </label>
                <label>
                  <span>Year</span>
                  <input
                    type="number"
                    value={yearFilter}
                    min={2000}
                    max={2100}
                    onChange={(event) => setYearFilter(Number(event.target.value))}
                  />
                </label>
              </div>
            )}

            {viewMode === 'year' && (
              <div className={styles.monthInputs}>
                <label>
                  <span>Year</span>
                  <input
                    type="number"
                    value={yearOnlyYear}
                    onChange={(event) => setYearOnlyYear(Number(event.target.value))}
                    min={2000}
                    max={2100}
                  />
                </label>
              </div>
            )}

            {viewMode === 'range' && (
              <div className={styles.rangeInputs}>
                <label>
                  <span>Start</span>
                  <input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
                </label>
                <label>
                  <span>End</span>
                  <input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
                </label>
              </div>
            )}

            <button className={styles.primaryButton} type="submit" disabled={loading}>
              <Search size={16} />
              {loading ? 'Loading…' : 'Load Income'}
            </button>
          </form>

          <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSort('source')}>
                      Source{sortConfig.field === 'source' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th scope="col" className={`${styles.numeric} ${styles.sortableHeader}`} onClick={() => handleSort('amount')}>
                      Amount{sortConfig.field === 'amount' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSort('date')}>
                      Received{sortConfig.field === 'date' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSort('monthYear')}>
                      Month &amp; Year{sortConfig.field === 'monthYear' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th scope="col" className={styles.actions}>Actions</th>
                  </tr>
                  <tr className={styles.tableFilterRow}>
                    <th scope="col">
                      <div className={styles.filterCell}>
                        <input
                          className={styles.tableFilterInput}
                          type="search"
                          placeholder="Filter source"
                          value={tableFilters.source}
                          onChange={(event) => handleFilterChange('source', event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              setCurrentPage(0)
                              if (lastQuery) void loadIncomes(lastQuery.mode, lastQuery.payload, 0, pageSize, buildIncomeServerParams(tableFilters, sortConfig))
                            }
                          }}
                        />
                        <button
                          type="button"
                          className={styles.filterSearchBtn}
                          onClick={() => {
                            setCurrentPage(0)
                            if (lastQuery) void loadIncomes(lastQuery.mode, lastQuery.payload, 0, pageSize, buildIncomeServerParams(tableFilters, sortConfig))
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
                              if (lastQuery) void loadIncomes(lastQuery.mode, lastQuery.payload, 0, pageSize, buildIncomeServerParams(newFilters, sortConfig))
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
                            if (lastQuery) void loadIncomes(lastQuery.mode, lastQuery.payload, 0, pageSize, buildIncomeServerParams(newFilters, sortConfig))
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
                            if (lastQuery) void loadIncomes(lastQuery.mode, lastQuery.payload, 0, pageSize, buildIncomeServerParams(newFilters, sortConfig));
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
                                  if (lastQuery) void loadIncomes(lastQuery.mode, lastQuery.payload, 0, pageSize, buildIncomeServerParams(tableFilters, sortConfig))
                                }
                              }}
                            />
                            <button
                              type="button"
                              className={styles.filterSearchBtn}
                              onClick={() => {
                                setCurrentPage(0)
                                if (lastQuery) void loadIncomes(lastQuery.mode, lastQuery.payload, 0, pageSize, buildIncomeServerParams(tableFilters, sortConfig))
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
                              if (lastQuery) void loadIncomes(lastQuery.mode, lastQuery.payload, 0, pageSize, buildIncomeServerParams(newFilters, sortConfig))
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
                                  if (lastQuery) void loadIncomes(lastQuery.mode, lastQuery.payload, 0, pageSize, buildIncomeServerParams(tableFilters, sortConfig))
                                }
                              }}
                            />
                            <button
                              type="button"
                              className={styles.filterSearchBtn}
                              onClick={() => {
                                setCurrentPage(0)
                                if (lastQuery) void loadIncomes(lastQuery.mode, lastQuery.payload, 0, pageSize, buildIncomeServerParams(tableFilters, sortConfig))
                              }}
                              title="Search"
                            ><Search size={13} /></button>
                          </>
                        )}
                      </div>
                    </th>
                    <th scope="col">
                      <input
                        className={styles.tableFilterInput}
                        type="search"
                        placeholder="Filter month &amp; year"
                        value={tableFilters.monthYear}
                        onChange={(event) => handleFilterChange('monthYear', event.target.value)}
                      />
                    </th>
                    <th scope="col">
                      <div className={styles.filterActions}>
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={() => (addingInline ? cancelInlineAdd() : beginInlineAdd())}
                        >
                          {addingInline ? 'Close' : 'Add Income'}
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
                            if (lastQuery) void loadIncomes(lastQuery.mode, lastQuery.payload, 0, pageSize, buildIncomeServerParams(tableFilters, newSort))
                          }} title="Clear sort">
                            Clear Sort
                          </button>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading && results.length === 0 ? (
                    [0,1,2,3].map((i) => (
                      <tr key={`sk-${i}`}>
                        <td><Skeleton /></td>
                        <td><Skeleton /></td>
                        <td><Skeleton /></td>
                        <td><Skeleton /></td>
                        <td></td>
                      </tr>
                    ))
                  ) : results.length === 0 ? (
                    <tr className={styles.emptyRow}>
                      <td colSpan={5}>{filtersApplied ? 'No income entries match the current filters.' : 'No income entries to display.'}</td>
                    </tr>
                  ) : (<>
                  {addingInline && inlineAddDraft && (
                    <tr key="__inline_add">
                      <td>
                        <input
                          className={styles.inlineInput}
                          type="text"
                          value={inlineAddDraft.source}
                          onChange={(e) => updateInlineAddDraft('source', e.target.value)}
                          placeholder="Source"
                        />
                      </td>
                      <td className={styles.numeric}>
                        <input
                          className={styles.inlineInput}
                          type="number"
                          min="0"
                          step="0.01"
                          value={inlineAddDraft.amount}
                          onChange={(e) => updateInlineAddDraft('amount', e.target.value)}
                        />
                      </td>
                      <td className={styles.date}>
                        <input
                          className={styles.inlineInput}
                          type="date"
                          value={inlineAddDraft.receivedDate}
                          onChange={(e) => updateInlineAddDraft('receivedDate', e.target.value)}
                        />
                      </td>
                      <td />
                      <td className={styles.actions}>
                        <button type="button" onClick={() => void confirmInlineAdd()} disabled={savingInlineAdd}>
                          {savingInlineAdd ? 'Adding...' : 'Confirm'}
                        </button>
                        <button type="button" onClick={cancelInlineAdd} disabled={savingInlineAdd}>
                          Cancel
                        </button>
                      </td>
                    </tr>
                  )}
                  {filteredResults.length === 0 ? (
                    <tr className={styles.emptyRow}>
                      <td colSpan={5}>No income entries match the current filters.</td>
                    </tr>
                  ) : (
                    filteredResults.map((income) => {
                      const key = ensureIncomeId(income)
                      const isEditing = editingRowId === key
                      const draft = isEditing ? editingRowDraft : null
                      const draftSource = draft?.source ?? income.source ?? ''
                      const draftAmount = draft?.amount ?? String(income.amount ?? '')
                      const draftDate =
                        draft?.receivedDate ?? (income.receivedDate ? String(income.receivedDate).slice(0, 10) : '')
                      const derived = draftDate ? deriveMonthYear(draftDate) : null
                      const fallbackDerived = income.receivedDate ? deriveMonthYear(String(income.receivedDate)) : null
                      const normalizedMonth =
                        typeof income.month === 'number'
                          ? MONTHS[income.month - 1] ?? String(income.month)
                          : income.month
                      const monthDisplay = derived?.monthName ?? normalizedMonth ?? fallbackDerived?.monthName ?? '-'
                      const yearDisplay = derived?.year ?? income.year ?? fallbackDerived?.year ?? ''

                      return (
                        <tr key={key}>
                          <td>
                            {isEditing ? (
                              <input
                                className={styles.inlineInput}
                                type="text"
                                value={draftSource}
                                onChange={(event) => updateInlineDraft('source', event.target.value)}
                              />
                            ) : (
                              draftSource || '-'
                            )}
                          </td>
                          <td className={styles.numeric}>
                            {isEditing ? (
                              <input
                                className={styles.inlineInput}
                                type="number"
                                min="0"
                                step="0.01"
                                value={draftAmount}
                                onChange={(event) => updateInlineDraft('amount', event.target.value)}
                              />
                            ) : (
                              formatCurrency(Number(income.amount ?? 0))
                            )}
                          </td>
                          <td className={styles.date}>
                            {isEditing ? (
                              <input
                                className={styles.inlineInput}
                                type="date"
                                value={draftDate}
                                onChange={(event) => updateInlineDraft('receivedDate', event.target.value)}
                              />
                            ) : (
                              formatDate(income.receivedDate)
                            )}
                          </td>
                          <td>{monthDisplay}, {yearDisplay}</td>
                          <td className={styles.actions}>
                            {isEditing ? (
                              <>
                                <button type="button" onClick={() => void confirmInlineEdit(income)} disabled={savingInlineEdit}>
                                  {savingInlineEdit ? 'Saving...' : 'Confirm'}
                                </button>
                                <button type="button" onClick={cancelInlineEdit} disabled={savingInlineEdit}>
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => startInlineEdit(income)} disabled={deletingIncomeIds.has(key) || savingInlineEdit || savingInlineAdd}>
                                  Edit
                                </button>
                                <button type="button" onClick={() => void handleDelete(income)} disabled={deletingIncomeIds.has(key)}>
                                  {deletingIncomeIds.has(key) ? 'Deleting...' : 'Delete'}
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                  </>)}
                </tbody>
                <tfoot>
                  {totalPages > 1 ? (
                    <>
                      <tr>
                        <td>Total income in this page</td>
                        <td className={styles.numeric}>
                          <span className={styles.totalPill}>{formatCurrency(totalIncome)}</span>
                        </td>
                        <td colSpan={3} />
                      </tr>
                      <tr>
                        <td>Total (all pages)</td>
                        <td className={styles.numeric}>
                          {allPagesTotal !== null ? (
                            <span className={styles.totalPill}>{formatCurrency(allPagesTotal)}</span>
                          ) : (
                            <span className={styles.totalPill}>…</span>
                          )}
                        </td>
                        <td colSpan={2} />
                        <td>
                          <button
                            type="button"
                            className={styles.exportButton}
                            onClick={() => { setExportModalDates(exportDateRange ?? {}); setExportModalOpen(true) }}
                            title="Export income for current selection"
                          >
                            <Download size={14} />
                            Export
                          </button>
                        </td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td>Total</td>
                      <td className={styles.numeric}>
                        <span className={styles.totalPill}>{formatCurrency(totalIncome)}</span>
                      </td>
                      <td colSpan={2} />
                      <td>
                        <button
                          type="button"
                          className={styles.exportButton}
                          onClick={() => { setExportModalDates(exportDateRange ?? {}); setExportModalOpen(true) }}
                          title="Export income for current selection"
                        >
                          <Download size={14} />
                          Export
                        </button>
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
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
                  Add Income
                </Typography>
                <Typography variant="body2" component="p" className={styles.subtitle}>
                  Capture a new income item.
                </Typography>
              </div>
            </div>
          </header>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span>Source</span>
              <input
                list="income-source-suggestions"
                value={formState.source}
                onChange={(event) => setFormState((previous) => ({ ...previous, source: event.target.value }))}
                placeholder="Salary, Freelance, Rent..."
                autoComplete="off"
                required
              />
              <datalist id="income-source-suggestions">
                {sourceSuggestions.map((source) => (
                  <option key={source} value={source} />
                ))}
              </datalist>
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
              <span>Received Date</span>
              <input
                type="date"
                value={formState.receivedDate}
                onChange={(event) => setFormState((previous) => ({ ...previous, receivedDate: event.target.value }))}
                required
              />
            </label>

            <div className={styles.formActions}>
              <button className={styles.primaryButton} type="submit" disabled={addingIncome}>
                {addingIncome ? 'Adding...' : 'Add Income'}
              </button>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => {
                  setFormState(initialForm)
                }}
                disabled={addingIncome}
              >
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
        defaultExportType="INCOME"
        defaultStartDate={exportModalDates.start}
        defaultEndDate={exportModalDates.end}
      />

      {/* Import Statement Modal */}
      <ImportStatementModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImported={() => {
          if (session) void reloadIncomesCache(session.userId)
          if (lastQuery) void loadIncomes(lastQuery.mode, lastQuery.payload, currentPage, pageSize)
        }}
      />
    </Grid>
  )
}
