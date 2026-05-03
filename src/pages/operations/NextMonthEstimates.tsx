import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react'
import { Typography } from '@mui/material'
import { Plus, Pencil, Trash2, Check, X, CreditCard, TrendingUp, Info, AlertTriangle, Wallet, ArrowDownCircle } from 'lucide-react'
import {
  fetchUserExpensesEstimates,
  fetchUserCreditCardEstimates,
  addUserExpensesEstimate,
  updateUserExpensesEstimate,
  deleteUserExpensesEstimate,
  addUserCreditCardEstimate,
  updateUserCreditCardEstimate,
  deleteUserCreditCardEstimate,
  fetchUserExpenseCategories,
  fetchIncomeEstimates,
  addIncomeEstimate,
  updateIncomeEstimate,
  deleteIncomeEstimate,
} from '../../api'
import type { UserExpensesEstimate, UserCreditCardEstimate, UserExpenseCategory, IncomeEstimate } from '../../types/app'
import { useAppDataContext } from '../../context/AppDataContext'
import { usePreferences } from '../../context/PreferencesContext'
import { useNotifications } from '../../context/NotificationsContext'
import { parseAmount, friendlyErrorMessage } from '../../utils/format'
import Skeleton from '../../components/Skeleton'
import styles from './NextMonthEstimates.module.css'

// ─── Local types ────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

type ExpEstimateGroup = {
  categoryId: string
  categoryName: string
  estimates: UserExpensesEstimate[]
}

type CCEstimateGroup = {
  cardName: string
  estimates: UserCreditCardEstimate[]
  total: number
}

type ExpAddForm = {
  userExpenseName: string
  userExpenseCategoryId: string
  amount: string
  status: 'A' | 'I'
}

type CCAddForm = {
  cardName: string
  expenseName: string
  amount: string
}

const emptyExpForm: ExpAddForm = { userExpenseName: '', userExpenseCategoryId: '', amount: '', status: 'A' }
const emptyCCForm: CCAddForm = { cardName: '', expenseName: '', amount: '' }

type IncomeAddForm = {
  source: string
  amount: string
  receivedDate: string
  month: string
  year: string
}

function createEmptyIncomeForm(): IncomeAddForm {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const mm = String(next.getMonth() + 1).padStart(2, '0')
  return {
    source: 'Salary',
    amount: '',
    receivedDate: `${next.getFullYear()}-${mm}-01`,
    month: MONTH_NAMES[next.getMonth()],
    year: String(next.getFullYear()),
  }
}

/** Returns YYYY-MM-01 for the first day of the selected month+year, but no earlier than the current month's first day */
function minDateForIncomeForm(month: string, year: string): string {
  const now = new Date()
  const currentFirst = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthIdx = MONTH_NAMES.indexOf(month)
  const yearNum = parseInt(year)
  if (monthIdx < 0 || isNaN(yearNum)) {
    return `${currentFirst.getFullYear()}-${String(currentFirst.getMonth() + 1).padStart(2, '0')}-01`
  }
  const selectedFirst = new Date(yearNum, monthIdx, 1)
  const base = selectedFirst > currentFirst ? selectedFirst : currentFirst
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-01`
}

/** Returns YYYY-MM-DD for the last day of the selected month+year */
function maxDateForIncomeForm(month: string, year: string): string {
  const monthIdx = MONTH_NAMES.indexOf(month)
  const yearNum = parseInt(year)
  if (monthIdx < 0 || isNaN(yearNum)) return ''
  const lastDay = new Date(yearNum, monthIdx + 1, 0)
  return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
}

/** True if the month+year combo is before the current month */
function isBeforeCurrentMonth(month: string, year: string): boolean {
  const now = new Date()
  const monthIdx = MONTH_NAMES.indexOf(month)
  const yearNum = parseInt(year)
  if (monthIdx < 0 || isNaN(yearNum)) return false
  return yearNum < now.getFullYear() || (yearNum === now.getFullYear() && monthIdx < now.getMonth())
}

function groupByCategory(estimates: UserExpensesEstimate[]): ExpEstimateGroup[] {
  const map = new Map<string, ExpEstimateGroup>()
  for (const est of estimates) {
    const key = String(est.userExpenseCategoryId)
    if (!map.has(key)) {
      map.set(key, { categoryId: key, categoryName: est.userExpenseCategoryName, estimates: [] })
    }
    map.get(key)!.estimates.push(est)
  }
  return Array.from(map.values())
}

function groupByCard(estimates: UserCreditCardEstimate[]): CCEstimateGroup[] {
  const map = new Map<string, CCEstimateGroup>()
  for (const est of estimates) {
    const key = est.cardName
    if (!map.has(key)) {
      map.set(key, { cardName: key, estimates: [], total: 0 })
    }
    const group = map.get(key)!
    group.estimates.push(est)
    group.total += Number(est.amount ?? 0)
  }
  return Array.from(map.values())
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function NextMonthEstimates(): ReactElement {
  const { session } = useAppDataContext()
  const { formatCurrency } = usePreferences()
  const { addNotification } = useNotifications()
  const userId = session?.userId ?? ''

  // ── Data state ──────────────────────────────────────────────────────────
  const [expEstimates, setExpEstimates] = useState<UserExpensesEstimate[]>([])
  const [ccEstimates, setCcEstimates] = useState<UserCreditCardEstimate[]>([])
  const [incomeEstimates, setIncomeEstimates] = useState<IncomeEstimate[]>([])
  const [categories, setCategories] = useState<UserExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)

  // ── Expense estimate form state ──────────────────────────────────────────
  const [showExpAddForm, setShowExpAddForm] = useState(false)
  const [expAddForm, setExpAddForm] = useState<ExpAddForm>(emptyExpForm)
  const [expAddSaving, setExpAddSaving] = useState(false)

  // ── Expense estimate inline edit state ──────────────────────────────────
  const [editingExpId, setEditingExpId] = useState<string | null>(null)
  const [editExpForm, setEditExpForm] = useState<ExpAddForm>(emptyExpForm)
  const [editExpSaving, setEditExpSaving] = useState(false)

  // ── CC estimate form state ───────────────────────────────────────────────
  const [showCCAddForm, setShowCCAddForm] = useState(false)
  const [ccAddForm, setCCAddForm] = useState<CCAddForm>(emptyCCForm)
  const [ccAddSaving, setCCAddSaving] = useState(false)

  // ── CC estimate inline edit state ───────────────────────────────────────
  const [editingCCId, setEditingCCId] = useState<string | null>(null)
  const [editCCForm, setEditCCForm] = useState<CCAddForm>(emptyCCForm)
  const [editCCSaving, setEditCCSaving] = useState(false)

  // ── Income estimate form state ───────────────────────────────────────────
  const [showIncomeAddForm, setShowIncomeAddForm] = useState(false)
  const [incomeAddForm, setIncomeAddForm] = useState<IncomeAddForm>(createEmptyIncomeForm)
  const [incomeAddSaving, setIncomeAddSaving] = useState(false)

  // ── Income estimate inline edit state ───────────────────────────────────
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null)
  const [editIncomeForm, setEditIncomeForm] = useState<IncomeAddForm>(createEmptyIncomeForm)
  const [editIncomeSaving, setEditIncomeSaving] = useState(false)

  // ── Delete confirmation state ─────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'exp' | 'cc' | 'income'; id: string | number; label: string } | null>(null)

  // ── Toast flag to avoid repeated warnings per load ───────────────────────
  const ccWarnShownRef = useRef(false)
  const inflightLoadRef = useRef<string | null>(null)

  // ── Load data ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!userId) return
    if (inflightLoadRef.current === userId) return
    inflightLoadRef.current = userId
    setLoading(true)
    ccWarnShownRef.current = false
    try {
      const [ests, ccEsts, cats, incEsts] = await Promise.all([
        fetchUserExpensesEstimates(userId),
        fetchUserCreditCardEstimates(userId),
        fetchUserExpenseCategories(userId),
        fetchIncomeEstimates(userId),
      ])
      setExpEstimates(ests)
      setCcEstimates(ccEsts)
      setCategories(cats)
      setIncomeEstimates(incEsts)
    } catch (err) {
      addNotification({ type: 'error', message: friendlyErrorMessage(err instanceof Error ? err.message : String(err)) })
    } finally {
      inflightLoadRef.current = null
      setLoading(false)
    }
  }, [userId, addNotification])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Derived: find Credit Card category ───────────────────────────────────
  const creditCardCategory = useMemo(
    () =>
      categories.find(
        (c) => c.userExpenseCategoryName.toLowerCase().replace(/\s+/g, '') === 'creditcard'
      ) ?? null,
    [categories]
  )

  const hasCCEstimates = ccEstimates.length > 0

  // Warn once when CC estimates exist but category is missing/inactive
  useEffect(() => {
    if (!loading && hasCCEstimates && !ccWarnShownRef.current) {
      if (!creditCardCategory || creditCardCategory.status !== 'A') {
        ccWarnShownRef.current = true
        addNotification({
          type: 'error',
          message:
            'You have credit card estimates but the "Credit Card" expense category is missing or inactive. Please add it and set it to active in your profile for it to appear under expense estimates.',
        })
      }
    }
  }, [loading, hasCCEstimates, creditCardCategory, addNotification])

  // ── Derived: grouped expense estimates ───────────────────────────────────
  const expGroups = useMemo(() => {
    const groups = groupByCategory(expEstimates)
    // If credit card category is active and there are CC estimates, append a synthetic group
    if (hasCCEstimates && creditCardCategory?.status === 'A') {
      const ccByCard = groupByCard(ccEstimates)
      const ccGroupKey = String(creditCardCategory.userExpenseCategoryId)
      // Avoid duplicating if user already has expense estimates under CC category
      const existing = groups.find((g) => g.categoryId === ccGroupKey)
      if (!existing) {
        groups.push({
          categoryId: ccGroupKey,
          categoryName: creditCardCategory.userExpenseCategoryName,
          estimates: [], // empty — CC sub-items rendered separately
          // We'll carry ccByCard on this group via a special marker
        })
      }
      // Attach CC sub-data as metadata (we use a workaround via a separate map)
      return { groups, ccByCard }
    }
    return { groups, ccByCard: [] as CCEstimateGroup[] }
  }, [expEstimates, ccEstimates, creditCardCategory, hasCCEstimates])

  const ccByCard = useMemo(() => groupByCard(ccEstimates), [ccEstimates])

  // ── Totals ────────────────────────────────────────────────────────────────
  const expTotal = useMemo(
    () => expEstimates.filter((e) => e.status === 'A').reduce((s, e) => s + Number(e.amount ?? 0), 0),
    [expEstimates]
  )

  const ccTotalFromCC = useMemo(
    () => ccEstimates.reduce((s, e) => s + Number(e.amount ?? 0), 0),
    [ccEstimates]
  )

  const grandTotal = useMemo(() => {
    const ccContrib = hasCCEstimates && creditCardCategory?.status === 'A' ? ccTotalFromCC : 0
    return expTotal + ccContrib
  }, [expTotal, ccTotalFromCC, hasCCEstimates, creditCardCategory])

  // ── Expense Estimate CRUD ─────────────────────────────────────────────────
  const handleExpAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!expAddForm.userExpenseName.trim() || !expAddForm.userExpenseCategoryId || !expAddForm.amount) return
    setExpAddSaving(true)
    try {
      const amt = parseAmount(expAddForm.amount)
      if (isNaN(amt) || amt <= 0) throw new Error('Invalid amount')
      await addUserExpensesEstimate({
        userId,
        userExpenseName: expAddForm.userExpenseName.trim(),
        userExpenseCategoryId: expAddForm.userExpenseCategoryId,
        amount: amt,
        status: expAddForm.status,
      })
      addNotification({ type: 'success', message: 'Expense estimate added.' })
      setExpAddForm(emptyExpForm)
      setShowExpAddForm(false)
      await loadData()
    } catch (err) {
      addNotification({ type: 'error', message: friendlyErrorMessage(err instanceof Error ? err.message : String(err)) })
    } finally {
      setExpAddSaving(false)
    }
  }

  const startEditExp = (est: UserExpensesEstimate) => {
    setEditingExpId(String(est.userExpensesEstimatesId))
    setEditExpForm({
      userExpenseName: est.userExpenseName,
      userExpenseCategoryId: String(est.userExpenseCategoryId),
      amount: String(est.amount),
      status: est.status,
    })
  }

  const handleExpEdit = async (e: FormEvent, id: string) => {
    e.preventDefault()
    setEditExpSaving(true)
    try {
      const amt = parseAmount(editExpForm.amount)
      if (isNaN(amt) || amt <= 0) throw new Error('Invalid amount')
      await updateUserExpensesEstimate({
        userId,
        id,
        userExpenseName: editExpForm.userExpenseName.trim(),
        userExpenseCategoryId: editExpForm.userExpenseCategoryId,
        amount: amt,
        status: editExpForm.status,
      })
      addNotification({ type: 'success', message: 'Expense estimate updated.' })
      setEditingExpId(null)
      await loadData()
    } catch (err) {
      addNotification({ type: 'error', message: friendlyErrorMessage(err instanceof Error ? err.message : String(err)) })
    } finally {
      setEditExpSaving(false)
    }
  }

  const handleExpDelete = (id: string | number, label: string) => {
    setDeleteConfirm({ type: 'exp', id, label })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    const { type, id } = deleteConfirm
    setDeleteConfirm(null)
    try {
      if (type === 'exp') {
        await deleteUserExpensesEstimate({ userId, id })
        addNotification({ type: 'success', message: 'Expense estimate deleted.' })
      } else if (type === 'cc') {
        await deleteUserCreditCardEstimate({ userId, id })
        addNotification({ type: 'success', message: 'Credit card estimate deleted.' })
      } else {
        await deleteIncomeEstimate({ userId, id })
        addNotification({ type: 'success', message: 'Income estimate deleted.' })
      }
      await loadData()
    } catch (err) {
      addNotification({ type: 'error', message: friendlyErrorMessage(err instanceof Error ? err.message : String(err)) })
    }
  }

  // ── Credit Card Estimate CRUD ─────────────────────────────────────────────
  const handleCCAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!ccAddForm.cardName.trim()) return
    setCCAddSaving(true)
    try {
      const amt = ccAddForm.amount ? parseAmount(ccAddForm.amount) : undefined
      if (amt !== undefined && (isNaN(amt) || amt < 0)) throw new Error('Invalid amount')
      await addUserCreditCardEstimate({
        userId,
        cardName: ccAddForm.cardName.trim(),
        expenseName: ccAddForm.expenseName.trim() || undefined,
        amount: amt,
      })
      addNotification({ type: 'success', message: 'Credit card estimate added.' })
      setCCAddForm(emptyCCForm)
      setShowCCAddForm(false)
      await loadData()
    } catch (err) {
      addNotification({ type: 'error', message: friendlyErrorMessage(err instanceof Error ? err.message : String(err)) })
    } finally {
      setCCAddSaving(false)
    }
  }

  const startEditCC = (est: UserCreditCardEstimate) => {
    setEditingCCId(String(est.userCreditCardEstimatesId))
    setEditCCForm({
      cardName: est.cardName,
      expenseName: est.expenseName ?? '',
      amount: est.amount !== undefined ? String(est.amount) : '',
    })
  }

  const handleCCEdit = async (e: FormEvent, id: string) => {
    e.preventDefault()
    setEditCCSaving(true)
    try {
      const amt = editCCForm.amount ? parseAmount(editCCForm.amount) : undefined
      if (amt !== undefined && (isNaN(amt) || amt < 0)) throw new Error('Invalid amount')
      await updateUserCreditCardEstimate({
        userId,
        id,
        cardName: editCCForm.cardName.trim(),
        expenseName: editCCForm.expenseName.trim() || undefined,
        amount: amt,
      })
      addNotification({ type: 'success', message: 'Credit card estimate updated.' })
      setEditingCCId(null)
      await loadData()
    } catch (err) {
      addNotification({ type: 'error', message: friendlyErrorMessage(err instanceof Error ? err.message : String(err)) })
    } finally {
      setEditCCSaving(false)
    }
  }

  const handleCCDelete = (id: string | number, label: string) => {
    setDeleteConfirm({ type: 'cc', id, label })
  }

  // ── Income Estimate CRUD ──────────────────────────────────────────────────

  // Available years for the income form (current year + next year)
  const now = new Date()
  const incomeYearOptions = [now.getFullYear(), now.getFullYear() + 1]

  function availableMonthsForYear(year: string): string[] {
    const yearNum = parseInt(year)
    if (yearNum === now.getFullYear()) {
      return MONTH_NAMES.slice(now.getMonth())
    }
    return MONTH_NAMES
  }

  const handleIncomeAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (isBeforeCurrentMonth(incomeAddForm.month, incomeAddForm.year)) {
      addNotification({ type: 'error', message: 'Month and year cannot be before the current month.' })
      return
    }
    setIncomeAddSaving(true)
    try {
      const amt = parseAmount(incomeAddForm.amount)
      if (isNaN(amt) || amt <= 0) throw new Error('Invalid amount')
      await addIncomeEstimate({
        userId,
        source: incomeAddForm.source.trim() || 'Salary',
        amount: amt,
        receivedDate: incomeAddForm.receivedDate,
        month: incomeAddForm.month,
        year: parseInt(incomeAddForm.year),
      })
      addNotification({ type: 'success', message: 'Income estimate added.' })
      setIncomeAddForm(createEmptyIncomeForm())
      setShowIncomeAddForm(false)
      await loadData()
    } catch (err) {
      addNotification({ type: 'error', message: friendlyErrorMessage(err instanceof Error ? err.message : String(err)) })
    } finally {
      setIncomeAddSaving(false)
    }
  }

  const startEditIncome = (est: IncomeEstimate) => {
    setEditingIncomeId(String(est.incomeEstimatesId))
    setEditIncomeForm({
      source: est.source,
      amount: String(est.amount),
      receivedDate: est.receivedDate,
      month: est.month,
      year: String(est.year),
    })
  }

  const handleIncomeEdit = async (e: FormEvent, id: string) => {
    e.preventDefault()
    if (isBeforeCurrentMonth(editIncomeForm.month, editIncomeForm.year)) {
      addNotification({ type: 'error', message: 'Month and year cannot be before the current month.' })
      return
    }
    setEditIncomeSaving(true)
    try {
      const amt = parseAmount(editIncomeForm.amount)
      if (isNaN(amt) || amt <= 0) throw new Error('Invalid amount')
      await updateIncomeEstimate({
        userId,
        id,
        source: editIncomeForm.source.trim() || 'Salary',
        amount: amt,
        receivedDate: editIncomeForm.receivedDate,
        month: editIncomeForm.month,
        year: parseInt(editIncomeForm.year),
      })
      addNotification({ type: 'success', message: 'Income estimate updated.' })
      setEditingIncomeId(null)
      await loadData()
    } catch (err) {
      addNotification({ type: 'error', message: friendlyErrorMessage(err instanceof Error ? err.message : String(err)) })
    } finally {
      setEditIncomeSaving(false)
    }
  }

  const handleIncomeDelete = (id: string | number, label: string) => {
    setDeleteConfirm({ type: 'income', id, label })
  }

  const incomeTotal = useMemo(
    () => incomeEstimates.reduce((s, e) => s + Number(e.amount ?? 0), 0),
    [incomeEstimates]
  )

  // ── Render ────────────────────────────────────────────────────────────────

  const activeCategories = categories.filter((c) => c.status === 'A')

  const ccCategoryActive = creditCardCategory?.status === 'A'
  const ccGroupKey = creditCardCategory ? String(creditCardCategory.userExpenseCategoryId) : null

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <Typography variant="h4" component="h1" className={styles.pageTitle}>
          Next Month Estimates
        </Typography>
        <Typography variant="body2" component="p" className={styles.pageSubtitle}>
          Plan your income estimates, expense estimates, and credit card spending for next month.
        </Typography>
      </div>

      {/* ── Info note ── */}
      <div className={styles.infoNote}>
        <Info size={16} className={styles.infoNoteIcon} />
        <span>
          These estimates will be automatically copied to your <strong>Planned Expenses</strong> at the start of next month,
          and the income sources listed here will be added to your <strong>Income</strong> for that month.
        </span>
      </div>

      {/* ── Summary bar ── */}
      <div className={styles.summaryBar}>
        <div className={styles.summaryItem}>
          <TrendingUp size={18} className={styles.summaryIconIncome} />
          <div>
            <span className={styles.summaryLabel}>Est. Income</span>
            <span className={styles.summaryValue}>{formatCurrency(incomeTotal)}</span>
          </div>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <ArrowDownCircle size={18} className={styles.summaryIconExpense} />
          <div>
            <span className={styles.summaryLabel}>Est. Expenses</span>
            <span className={styles.summaryValue}>{formatCurrency(grandTotal)}</span>
          </div>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <Wallet size={18} className={incomeTotal - grandTotal >= 0 ? styles.summaryIconBalance : styles.summaryIconDeficit} />
          <div>
            <span className={styles.summaryLabel}>Remaining Balance</span>
            <span className={`${styles.summaryValue} ${incomeTotal - grandTotal >= 0 ? styles.summaryPositive : styles.summaryNegative}`}>
              {formatCurrency(incomeTotal - grandTotal)}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.columns}>
        {/* ── Left: Expense Estimates ─────────────────────────────────────── */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleRow}>
              <span className={styles.emojiIcon} aria-hidden="true">📋</span>
              <div>
                <Typography variant="h5" component="h2" className={styles.cardTitle}>
                  Expense Estimates
                </Typography>
                <Typography variant="body2" component="p" className={styles.cardSubtitle}>
                  Planned expenses for next month, by category.
                </Typography>
              </div>
            </div>
            <div className={styles.headerRight}>
              <span className={styles.totalBadge}>{formatCurrency(grandTotal)}</span>
              <button
                type="button"
                className={styles.addButton}
                onClick={() => { setShowExpAddForm((v) => !v); setEditingExpId(null) }}
              >
                <Plus size={14} />
                Add
              </button>
            </div>
          </div>

          {loading ? (
            <div>
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.skeletonRow}>
                  <div style={{ width: 110 }}><Skeleton /></div>
                  <div style={{ flex: 1 }}><Skeleton /></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {expEstimates.length === 0 && !(hasCCEstimates && ccCategoryActive) ? (
                <Typography variant="body2" component="p" className={styles.placeholder}>
                  No expense estimates yet. Click "+ Add" to create your first estimate.
                </Typography>
              ) : (
                <div className={styles.tableContainer}>
                  <div className={styles.gridHeader}>
                    <div className={styles.gridHeaderCell}>Category</div>
                    <div className={styles.gridHeaderCell}>Estimates</div>
                  </div>

                  <div className={styles.gridBody}>
                    {expGroups.groups.map((group) => {
                      const isCCGroup = group.categoryId === ccGroupKey
                      const groupTotal = isCCGroup
                        ? ccTotalFromCC
                        : group.estimates.reduce((s, e) => s + Number(e.amount ?? 0), 0)

                      return (
                        <div key={group.categoryId} className={styles.categoryRow}>
                          <div className={styles.categoryCell}>
                            <span className={styles.categoryName}>{group.categoryName}</span>
                            <span className={styles.categoryTotal}>{formatCurrency(groupTotal)}</span>
                            {isCCGroup && (
                              <span className={styles.ccCategoryLabel}>
                                <CreditCard size={11} />
                                via credit cards
                              </span>
                            )}
                          </div>

                          <div className={styles.itemsCell}>
                            {isCCGroup ? (
                              // Render CC sub-items grouped by card name
                              <>
                                {expGroups.ccByCard.map((cardGroup) => (
                                  <div key={cardGroup.cardName}>
                                    {cardGroup.estimates.map((ccEst) => (
                                      <div key={String(ccEst.userCreditCardEstimatesId)} className={styles.ccSubItem}>
                                        <span className={styles.ccSubItemName}>
                                          <CreditCard size={12} />
                                          {cardGroup.cardName}
                                          {ccEst.expenseName ? ` — ${ccEst.expenseName}` : ''}
                                        </span>
                                        <span className={styles.ccSubItemAmount}>
                                          {ccEst.amount !== undefined ? formatCurrency(Number(ccEst.amount)) : '—'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                                <p className={styles.ccManagedNote}>Manage in the Credit Card section →</p>
                              </>
                            ) : (
                              <ul className={styles.itemList}>
                                {group.estimates.length === 0 ? (
                                  <li className={styles.emptyRow}>No estimates in this category.</li>
                                ) : (
                                  group.estimates.map((est) => {
                                    const id = String(est.userExpensesEstimatesId)
                                    const isEditing = editingExpId === id
                                    return (
                                      <li key={id}>
                                        {isEditing ? (
                                          <form
                                            className={styles.inlineForm}
                                            onSubmit={(e) => handleExpEdit(e, id)}
                                          >
                                            <input
                                              className={styles.inlineInput}
                                              value={editExpForm.userExpenseName}
                                              onChange={(e) =>
                                                setEditExpForm((f) => ({ ...f, userExpenseName: e.target.value }))
                                              }
                                              placeholder="Expense name"
                                              required
                                            />
                                            <select
                                              className={styles.inlineSelect}
                                              value={editExpForm.userExpenseCategoryId}
                                              onChange={(e) =>
                                                setEditExpForm((f) => ({ ...f, userExpenseCategoryId: e.target.value }))
                                              }
                                              required
                                            >
                                              <option value="">Category</option>
                                              {activeCategories.map((c) => (
                                                <option key={String(c.userExpenseCategoryId)} value={String(c.userExpenseCategoryId)}>
                                                  {c.userExpenseCategoryName}
                                                </option>
                                              ))}
                                            </select>
                                            <input
                                              className={styles.inlineInput}
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              value={editExpForm.amount}
                                              onChange={(e) =>
                                                setEditExpForm((f) => ({ ...f, amount: e.target.value }))
                                              }
                                              placeholder="Amount"
                                              required
                                              style={{ maxWidth: 90 }}
                                            />
                                            <select
                                              className={styles.inlineSelect}
                                              value={editExpForm.status}
                                              onChange={(e) =>
                                                setEditExpForm((f) => ({
                                                  ...f,
                                                  status: e.target.value as 'A' | 'I',
                                                }))
                                              }
                                              style={{ maxWidth: 100 }}
                                            >
                                              <option value="A">Active</option>
                                              <option value="I">Inactive</option>
                                            </select>
                                            <div className={styles.inlineFormActions}>
                                              <button type="submit" className={styles.saveButton} disabled={editExpSaving}>
                                                <Check size={13} />{editExpSaving ? 'Saving…' : 'Save'}
                                              </button>
                                              <button
                                                type="button"
                                                className={styles.cancelButton}
                                                onClick={() => setEditingExpId(null)}
                                              >
                                                <X size={13} />
                                              </button>
                                            </div>
                                          </form>
                                        ) : (
                                          <div className={styles.itemRow}>
                                            <div className={styles.itemInfo}>
                                              <span className={styles.itemName}>{est.userExpenseName}</span>
                                              {est.status === 'I' && (
                                                <span className={styles.inactiveChip}>Inactive</span>
                                              )}
                                            </div>
                                            <span className={styles.itemAmount}>
                                              {formatCurrency(Number(est.amount ?? 0))}
                                            </span>
                                            <div className={styles.itemActions}>
                                              <button
                                                type="button"
                                                className={styles.iconButton}
                                                onClick={() => startEditExp(est)}
                                                aria-label={`Edit ${est.userExpenseName}`}
                                              >
                                                <Pencil size={14} />
                                              </button>
                                              <button
                                                type="button"
                                                className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                                                onClick={() => handleExpDelete(est.userExpensesEstimatesId, est.userExpenseName)}
                                                aria-label={`Delete ${est.userExpenseName}`}
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </li>
                                    )
                                  })
                                )}
                              </ul>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Add expense estimate form */}
              {showExpAddForm && (
                <div className={styles.addFormContainer}>
                  <p className={styles.addFormTitle}>New Expense Estimate</p>
                  <form className={styles.addFormRow} onSubmit={handleExpAdd}>
                    <input
                      className={styles.formInput}
                      value={expAddForm.userExpenseName}
                      onChange={(e) => setExpAddForm((f) => ({ ...f, userExpenseName: e.target.value }))}
                      placeholder="Expense name *"
                      required
                    />
                    <select
                      className={styles.formSelect}
                      value={expAddForm.userExpenseCategoryId}
                      onChange={(e) => setExpAddForm((f) => ({ ...f, userExpenseCategoryId: e.target.value }))}
                      required
                    >
                      <option value="">Select category *</option>
                      {activeCategories.map((c) => (
                        <option key={String(c.userExpenseCategoryId)} value={String(c.userExpenseCategoryId)}>
                          {c.userExpenseCategoryName}
                        </option>
                      ))}
                    </select>
                    <input
                      className={styles.formInput}
                      type="number"
                      min="0"
                      step="0.01"
                      value={expAddForm.amount}
                      onChange={(e) => setExpAddForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="Amount *"
                      required
                      style={{ maxWidth: 110 }}
                    />
                    <select
                      className={styles.formSelect}
                      value={expAddForm.status}
                      onChange={(e) => setExpAddForm((f) => ({ ...f, status: e.target.value as 'A' | 'I' }))}
                      style={{ maxWidth: 110 }}
                    >
                      <option value="A">Active</option>
                      <option value="I">Inactive</option>
                    </select>
                    <div className={styles.formActions}>
                      <button type="submit" className={styles.saveButton} disabled={expAddSaving}>
                        <Check size={14} />{expAddSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className={styles.cancelButton}
                        onClick={() => { setShowExpAddForm(false); setExpAddForm(emptyExpForm) }}
                      >
                        <X size={14} /> Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {expEstimates.length > 0 && (
                <div className={styles.cardFooter}>
                  <span className={styles.footerLabel}>Total planned</span>
                  <span className={styles.footerAmount}>{formatCurrency(grandTotal)}</span>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Right: Income + Credit Card Estimates ────────────────────────── */}
        <div className={styles.rightColumn}>

          {/* ── Income Estimates ──────────────────────────────────────────── */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitleRow}>
                <span className={styles.emojiIcon} aria-hidden="true">💰</span>
                <div>
                  <Typography variant="h5" component="h2" className={styles.cardTitle}>
                    Income Estimates
                  </Typography>
                  <Typography variant="body2" component="p" className={styles.cardSubtitle}>
                    Planned income sources for next month.
                  </Typography>
                </div>
              </div>
              <div className={styles.headerRight}>
                <span className={styles.totalBadge}>{formatCurrency(incomeTotal)}</span>
                <button
                  type="button"
                  className={styles.addButton}
                  onClick={() => { setShowIncomeAddForm((v) => !v); setEditingIncomeId(null) }}
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>
            </div>

            {loading ? (
              <div>
                {[0, 1].map((i) => (
                  <div key={i} className={styles.skeletonRow}>
                    <div style={{ width: 100 }}><Skeleton /></div>
                    <div style={{ flex: 1 }}><Skeleton /></div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {incomeEstimates.length === 0 ? (
                  <Typography variant="body2" component="p" className={styles.placeholder}>
                    No income estimates yet. Click &quot;+ Add&quot; to plan your income sources.
                  </Typography>
                ) : (
                  <div className={styles.incomeList}>
                    {incomeEstimates.map((est) => {
                      const id = String(est.incomeEstimatesId)
                      const isEditing = editingIncomeId === id
                      return (
                        <div key={id}>
                          {isEditing ? (
                            <form className={styles.inlineForm} onSubmit={(e) => handleIncomeEdit(e, id)}>
                              <input
                                className={styles.inlineInput}
                                value={editIncomeForm.source}
                                onChange={(e) => setEditIncomeForm((f) => ({ ...f, source: e.target.value }))}
                                placeholder="Source (e.g. Salary)"
                                required
                              />
                              <input
                                className={styles.inlineInput}
                                type="number"
                                min="0"
                                step="0.01"
                                value={editIncomeForm.amount}
                                onChange={(e) => setEditIncomeForm((f) => ({ ...f, amount: e.target.value }))}
                                placeholder="Amount *"
                                required
                                style={{ maxWidth: 110 }}
                              />
                              <input
                                className={styles.inlineInput}
                                type="date"
                                value={editIncomeForm.receivedDate}
                                min={minDateForIncomeForm(editIncomeForm.month, editIncomeForm.year)}
                                max={maxDateForIncomeForm(editIncomeForm.month, editIncomeForm.year)}
                                onChange={(e) => setEditIncomeForm((f) => ({ ...f, receivedDate: e.target.value }))}
                                required
                                style={{ maxWidth: 140 }}
                              />
                              <select
                                className={styles.inlineSelect}
                                value={editIncomeForm.month}
                                onChange={(e) => {
                                  const newMonth = e.target.value
                                  setEditIncomeForm((f) => ({
                                    ...f,
                                    month: newMonth,
                                    receivedDate: minDateForIncomeForm(newMonth, f.year),
                                  }))
                                }}
                                required
                                style={{ maxWidth: 120 }}
                              >
                                {availableMonthsForYear(editIncomeForm.year).map((m) => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                              <select
                                className={styles.inlineSelect}
                                value={editIncomeForm.year}
                                onChange={(e) => {
                                  const newYear = e.target.value
                                  const months = availableMonthsForYear(newYear)
                                  const validMonth = months.includes(editIncomeForm.month) ? editIncomeForm.month : months[0]
                                  setEditIncomeForm((f) => ({
                                    ...f,
                                    year: newYear,
                                    month: validMonth,
                                    receivedDate: minDateForIncomeForm(validMonth, newYear),
                                  }))
                                }}
                                required
                                style={{ maxWidth: 80 }}
                              >
                                {incomeYearOptions.map((y) => (
                                  <option key={y} value={String(y)}>{y}</option>
                                ))}
                              </select>
                              <div className={styles.inlineFormActions}>
                                <button type="submit" className={styles.saveButton} disabled={editIncomeSaving}>
                                  <Check size={13} />{editIncomeSaving ? 'Saving…' : 'Save'}
                                </button>
                                <button
                                  type="button"
                                  className={styles.cancelButton}
                                  onClick={() => setEditingIncomeId(null)}
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            </form>
                          ) : (
                            <div className={styles.incomeItemRow}>
                              <div className={styles.incomeItemInfo}>
                                <span className={styles.incomeItemSource}>
                                  <TrendingUp size={13} />
                                  {est.source}
                                </span>
                                <span className={styles.incomeItemMeta}>
                                  {est.month} {est.year} · {est.receivedDate}
                                </span>
                              </div>
                              <span className={styles.incomeItemAmount}>{formatCurrency(Number(est.amount ?? 0))}</span>
                              <div className={styles.itemActions}>
                                <button
                                  type="button"
                                  className={styles.iconButton}
                                  onClick={() => startEditIncome(est)}
                                  aria-label={`Edit ${est.source}`}
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                                  onClick={() => handleIncomeDelete(est.incomeEstimatesId, est.source)}
                                  aria-label={`Delete ${est.source}`}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Add income estimate form */}
                {showIncomeAddForm && (
                  <div className={styles.addFormContainer}>
                    <p className={styles.addFormTitle}>New Income Estimate</p>
                    <form className={styles.addFormRow} onSubmit={handleIncomeAdd}>
                      <input
                        className={styles.formInput}
                        value={incomeAddForm.source}
                        onChange={(e) => setIncomeAddForm((f) => ({ ...f, source: e.target.value }))}
                        placeholder="Source (e.g. Salary)"
                        required
                      />
                      <input
                        className={styles.formInput}
                        type="number"
                        min="0"
                        step="0.01"
                        value={incomeAddForm.amount}
                        onChange={(e) => setIncomeAddForm((f) => ({ ...f, amount: e.target.value }))}
                        placeholder="Amount *"
                        required
                        style={{ maxWidth: 110 }}
                      />
                      <input
                        className={styles.formInput}
                        type="date"
                        value={incomeAddForm.receivedDate}
                        min={minDateForIncomeForm(incomeAddForm.month, incomeAddForm.year)}
                        max={maxDateForIncomeForm(incomeAddForm.month, incomeAddForm.year)}
                        onChange={(e) => setIncomeAddForm((f) => ({ ...f, receivedDate: e.target.value }))}
                        required
                        style={{ maxWidth: 140 }}
                      />
                      <select
                        className={styles.formSelect}
                        value={incomeAddForm.month}
                        onChange={(e) => {
                          const newMonth = e.target.value
                          setIncomeAddForm((f) => ({
                            ...f,
                            month: newMonth,
                            receivedDate: minDateForIncomeForm(newMonth, f.year),
                          }))
                        }}
                        required
                      >
                        {availableMonthsForYear(incomeAddForm.year).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <select
                        className={styles.formSelect}
                        value={incomeAddForm.year}
                        onChange={(e) => {
                          const newYear = e.target.value
                          const months = availableMonthsForYear(newYear)
                          const validMonth = months.includes(incomeAddForm.month) ? incomeAddForm.month : months[0]
                          setIncomeAddForm((f) => ({
                            ...f,
                            year: newYear,
                            month: validMonth,
                            receivedDate: minDateForIncomeForm(validMonth, newYear),
                          }))
                        }}
                        required
                        style={{ maxWidth: 90 }}
                      >
                        {incomeYearOptions.map((y) => (
                          <option key={y} value={String(y)}>{y}</option>
                        ))}
                      </select>
                      <div className={styles.formActions}>
                        <button type="submit" className={styles.saveButton} disabled={incomeAddSaving}>
                          <Check size={14} />{incomeAddSaving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className={styles.cancelButton}
                          onClick={() => { setShowIncomeAddForm(false); setIncomeAddForm(createEmptyIncomeForm()) }}
                        >
                          <X size={14} /> Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {incomeEstimates.length > 0 && (
                  <div className={styles.cardFooter}>
                    <span className={styles.footerLabel}>Total income</span>
                    <span className={styles.footerAmount}>{formatCurrency(incomeTotal)}</span>
                  </div>
                )}
              </>
            )}
          </section>

          {/* ── Credit Card Estimates ──────────────────────────────────────── */}
          <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleRow}>
              <span className={styles.emojiIcon} aria-hidden="true">💳</span>
              <div>
                <Typography variant="h5" component="h2" className={styles.cardTitle}>
                  Credit Card Estimates
                </Typography>
                <Typography variant="body2" component="p" className={styles.cardSubtitle}>
                  Planned credit card spending, grouped by card.
                </Typography>
              </div>
            </div>
            <div className={styles.headerRight}>
              <span className={styles.totalBadge}>{formatCurrency(ccTotalFromCC)}</span>
              <button
                type="button"
                className={styles.addButton}
                onClick={() => { setShowCCAddForm((v) => !v); setEditingCCId(null) }}
              >
                <Plus size={14} />
                Add
              </button>
            </div>
          </div>

          {loading ? (
            <div>
              {[0, 1].map((i) => (
                <div key={i} className={styles.skeletonRow}>
                  <div style={{ width: 100 }}><Skeleton /></div>
                  <div style={{ flex: 1 }}><Skeleton /></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {ccEstimates.length === 0 ? (
                <Typography variant="body2" component="p" className={styles.placeholder}>
                  No credit card estimates yet. Click "+ Add" to plan your credit card spending.
                </Typography>
              ) : (
                <div>
                  {ccByCard.map((cardGroup) => (
                    <div key={cardGroup.cardName} className={styles.cardGroup}>
                      <div className={styles.cardGroupHeader}>
                        <span className={styles.cardGroupName}>
                          <CreditCard size={15} />
                          {cardGroup.cardName}
                        </span>
                        <span className={styles.cardGroupTotal}>{formatCurrency(cardGroup.total)}</span>
                      </div>
                      <ul className={styles.ccItemList}>
                        {cardGroup.estimates.map((est) => {
                          const id = String(est.userCreditCardEstimatesId)
                          const isEditing = editingCCId === id
                          return (
                            <li key={id}>
                              {isEditing ? (
                                <form
                                  className={styles.inlineForm}
                                  onSubmit={(e) => handleCCEdit(e, id)}
                                >
                                  <input
                                    className={styles.inlineInput}
                                    value={editCCForm.cardName}
                                    onChange={(e) =>
                                      setEditCCForm((f) => ({ ...f, cardName: e.target.value }))
                                    }
                                    placeholder="Card name *"
                                    required
                                  />
                                  <input
                                    className={styles.inlineInput}
                                    value={editCCForm.expenseName}
                                    onChange={(e) =>
                                      setEditCCForm((f) => ({ ...f, expenseName: e.target.value }))
                                    }
                                    placeholder="Expense name"
                                  />
                                  <input
                                    className={styles.inlineInput}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editCCForm.amount}
                                    onChange={(e) =>
                                      setEditCCForm((f) => ({ ...f, amount: e.target.value }))
                                    }
                                    placeholder="Amount"
                                    style={{ maxWidth: 90 }}
                                  />
                                  <div className={styles.inlineFormActions}>
                                    <button type="submit" className={styles.saveButton} disabled={editCCSaving}>
                                      <Check size={13} />{editCCSaving ? 'Saving…' : 'Save'}
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.cancelButton}
                                      onClick={() => setEditingCCId(null)}
                                    >
                                      <X size={13} />
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <div className={styles.ccItemRow}>
                                  <div className={styles.ccItemInfo}>
                                    {est.expenseName ? (
                                      <span className={styles.ccItemName}>{est.expenseName}</span>
                                    ) : (
                                      <span className={styles.ccItemNoName}>No description</span>
                                    )}
                                  </div>
                                  <span className={styles.ccItemAmount}>
                                    {est.amount !== undefined ? formatCurrency(Number(est.amount)) : '—'}
                                  </span>
                                  <div className={styles.itemActions}>
                                    <button
                                      type="button"
                                      className={styles.iconButton}
                                      onClick={() => startEditCC(est)}
                                      aria-label={`Edit ${est.expenseName ?? est.cardName}`}
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                                      onClick={() => handleCCDelete(est.userCreditCardEstimatesId, est.expenseName ?? est.cardName)}
                                      aria-label={`Delete ${est.expenseName ?? est.cardName}`}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {/* Add CC estimate form */}
              {showCCAddForm && (
                <div className={styles.addFormContainer}>
                  <p className={styles.addFormTitle}>New Credit Card Estimate</p>
                  <form className={styles.addFormRow} onSubmit={handleCCAdd}>
                    <datalist id="cc-card-names-add">
                      {ccByCard.map((g) => (
                        <option key={g.cardName} value={g.cardName} />
                      ))}
                    </datalist>
                    <input
                      className={styles.formInput}
                      value={ccAddForm.cardName}
                      onChange={(e) => setCCAddForm((f) => ({ ...f, cardName: e.target.value }))}
                      placeholder="Card name *"
                      list="cc-card-names-add"
                      required
                    />
                    <input
                      className={styles.formInput}
                      value={ccAddForm.expenseName}
                      onChange={(e) => setCCAddForm((f) => ({ ...f, expenseName: e.target.value }))}
                      placeholder="Expense description"
                    />
                    <input
                      className={styles.formInput}
                      type="number"
                      min="0"
                      step="0.01"
                      value={ccAddForm.amount}
                      onChange={(e) => setCCAddForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="Amount"
                      style={{ maxWidth: 110 }}
                    />
                    <div className={styles.formActions}>
                      <button type="submit" className={styles.saveButton} disabled={ccAddSaving}>
                        <Check size={14} />{ccAddSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className={styles.cancelButton}
                        onClick={() => { setShowCCAddForm(false); setCCAddForm(emptyCCForm) }}
                      >
                        <X size={14} /> Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {ccEstimates.length > 0 && (
                <div className={styles.cardFooter}>
                  <span className={styles.footerLabel}>Total credit card</span>
                  <span className={styles.footerAmount}>{formatCurrency(ccTotalFromCC)}</span>
                </div>
              )}
            </>
          )}
        </section>
        </div>
      </div>

      {/* ── Delete confirmation modal ── */}
      {deleteConfirm && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Confirm delete">
          <div className={styles.modalBox}>
            <div className={styles.modalIconRow}>
              <AlertTriangle size={28} className={styles.modalWarningIcon} />
            </div>
            <p className={styles.modalTitle}>Delete Estimate?</p>
            <p className={styles.modalBody}>
              Are you sure you want to delete <strong>&quot;{deleteConfirm.label}&quot;</strong>? This cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.modalCancelBtn} onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button className={styles.modalDeleteBtn} onClick={confirmDelete}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
