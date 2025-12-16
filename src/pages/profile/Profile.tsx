import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { useAppDataContext } from '../../context/AppDataContext'
import { usePreferences } from '../../context/PreferencesContext'
import { useTheme } from '../../context/ThemeContext'
import type { SessionData, UserExpenseCategory, UserExpense, FontSize, CurrencyCode } from '../../types/app'
import { CURRENCY_OPTIONS, FONT_SIZE_OPTIONS } from '../../types/app'
import {
  copyUserExpenseCategoriesFromMaster,
  createUserExpenseCategory,
  deleteUserExpenseCategory,
  fetchUserExpenseCategories,
  updateUserExpenseCategory,
  createUserExpense,
  updateUserExpense,
  deleteUserExpense,
} from '../../api'
import styles from './Profile.module.css'
import Skeleton from '../../components/Skeleton'

type ProfileProps = {
  session: SessionData | null
  onRequestReset?: (username: string) => void
}

const getString = (value: unknown): string => (typeof value === 'string' ? value : '')

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null

type CategoryDraft = {
  name: string
  status: 'A' | 'I'
}

const MAX_USER_CATEGORIES = 20
const MAX_USER_EXPENSES = 100

type ExpenseDraft = {
  name: string
  status: 'A' | 'I'
  categoryId: string
  amount: string
}

type PreferenceTab = 'categories' | 'expenses' | 'display' | 'currency'

const toAmountString = (value: number | string | undefined): string => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString() : ''
  }
  if (typeof value === 'string') {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric.toString() : ''
  }
  return ''
}

const parseAmount = (input: string): number | null => {
  const trimmed = input.trim()
  if (!trimmed) return null
  const numeric = Number(trimmed)
  if (!Number.isFinite(numeric)) {
    return null
  }
  return numeric
}

export default function Profile({ session, onRequestReset }: ProfileProps): ReactElement {
  const sessionRecord = asRecord(session)
  const user = asRecord(sessionRecord?.user) ?? {}
  const sessionIdentifier = getString(sessionRecord?.identifier) || (session?.username ?? '')
  const displayUsername = getString(user.username) || getString(user.userName) || sessionIdentifier
  const email = getString(user.email)
  const loginUsername = session?.username ?? ''

  const {
    setStatus,
    expenseCategories: activeCategories,
    ensureExpenseCategories,
    ensureUserExpenses,
    ensureActiveUserExpenses,
  } = useAppDataContext()

  const {
    fontSize,
    currencyCode,
    currencySymbol,
    setFontSize,
    setCurrencyCode,
  } = usePreferences()

  const { theme, setTheme } = useTheme()

  // Preference tab state
  const [activeTab, setActiveTab] = useState<PreferenceTab | null>(null)

  const [categories, setCategories] = useState<UserExpenseCategory[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [categoryActionInFlight, setCategoryActionInFlight] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | number | null>(null)
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null)
  const [addingCategory, setAddingCategory] = useState(false)
  const [categoryAddDraft, setCategoryAddDraft] = useState<CategoryDraft>({ name: '', status: 'A' })
  const [expenses, setExpenses] = useState<UserExpense[]>([])
  const [loadingExpenses, setLoadingExpenses] = useState(false)
  const [expenseActionInFlight, setExpenseActionInFlight] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | number | null>(null)
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft | null>(null)
  const [addingExpense, setAddingExpense] = useState(false)
  const [expenseAddDraft, setExpenseAddDraft] = useState<ExpenseDraft>({
    name: '',
    status: 'A',
    categoryId: '',
    amount: '',
  })

  const amountFormatter = useMemo(
    () => new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [],
  )

  const canManageCategories = Boolean(loginUsername)
  const canManageExpenses = Boolean(loginUsername)

  const formatAmountDisplay = useCallback(
    (value: number | string | undefined): string => {
      const numeric = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(numeric)) {
        return '-'
      }
      return `${currencySymbol}${amountFormatter.format(numeric)}`
    },
    [amountFormatter, currencySymbol],
  )

  const categoryLookup = useMemo(() => {
    const map = new Map<string, UserExpenseCategory>()
    // Use active categories for lookup in the planned-expense dropdown
    // so the dropdown lists only active categories when adding/editing expenses.
    activeCategories.forEach((category) => {
      const key = String(category.userExpenseCategoryId)
      if (key) {
        map.set(key, category)
      }
    })
    return map
  }, [activeCategories])

  const categoryOptions = useMemo(
    () =>
      Array.from(categoryLookup.entries())
        .map(([id, category]) => ({
          id,
          label: category.userExpenseCategoryName,
          status: category.status,
        }))
        .sort((a, b) => {
          if (a.status !== b.status) {
            return a.status === 'A' ? -1 : 1
          }
          return a.label.localeCompare(b.label)
        }),
    [categoryLookup],
  )

  const hasActiveCategory = categoryOptions.some((option) => option.status === 'A')

  const categoriesWithSerial = useMemo(
    () => categories.map((category, index) => ({ ...category, serial: index + 1 })),
    [categories],
  )

  const expensesWithSerial = useMemo(
    () => expenses.map((expense, index) => ({ ...expense, serial: index + 1 })),
    [expenses],
  )

  const categoryLimitReached = categories.length >= MAX_USER_CATEGORIES
  const expenseLimitReached = expenses.length >= MAX_USER_EXPENSES

  const syncActiveCategories = useCallback(async () => {
    if (!loginUsername) return
    try {
      await ensureExpenseCategories()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    }
  }, [ensureExpenseCategories, loginUsername, setStatus])

  const refreshUserCategories = useCallback(async () => {
    if (!loginUsername) return
    setLoadingCategories(true)
    try {
      const allCategories = await fetchUserExpenseCategories(loginUsername)
      setCategories(allCategories)
      await syncActiveCategories()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    } finally {
      setLoadingCategories(false)
    }
  }, [loginUsername, setStatus, syncActiveCategories])

  const syncActiveExpenses = useCallback(async () => {
    if (!loginUsername) return
    try {
      await ensureActiveUserExpenses()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    }
  }, [ensureActiveUserExpenses, loginUsername, setStatus])

  const refreshUserExpenses = useCallback(async () => {
    if (!loginUsername) return
    setLoadingExpenses(true)
    try {
      const allExpenses = await ensureUserExpenses()
      setExpenses(allExpenses)
      await syncActiveExpenses()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    } finally {
      setLoadingExpenses(false)
    }
  }, [ensureUserExpenses, loginUsername, setStatus, syncActiveExpenses])

  useEffect(() => {
    // Always refresh the user's categories when the profile loads so the
    // profile page shows the full set (not only the active ones).
    if (loginUsername) {
      void refreshUserCategories()
    }
  }, [loginUsername, refreshUserCategories])

  useEffect(() => {
    // Refresh whenever the categories tab is opened so edits elsewhere stay in sync.
    if (activeTab === 'categories' && loginUsername) {
      void refreshUserCategories()
    }
  }, [activeTab, loginUsername, refreshUserCategories])

  useEffect(() => {
    if (activeTab === 'expenses' && loginUsername) {
      void refreshUserExpenses()
    }
  }, [activeTab, loginUsername, refreshUserExpenses])

  useEffect(() => {
    if (!loginUsername) {
      setActiveTab(null)
      setCategories([])
      setExpenses([])
    }
  }, [loginUsername])

  const handleResetPassword = () => {
    if (displayUsername) {
      onRequestReset?.(displayUsername)
    }
  }

  const startEdit = (category: UserExpenseCategory) => {
    setEditingCategoryId(category.userExpenseCategoryId)
    setCategoryDraft({ name: category.userExpenseCategoryName, status: category.status })
  }

  const cancelEdit = () => {
    setEditingCategoryId(null)
    setCategoryDraft(null)
  }

  const beginAddCategory = () => {
    setAddingCategory(true)
    setCategoryAddDraft({ name: '', status: 'A' })
  }

  const cancelAddCategory = () => {
    setAddingCategory(false)
    setCategoryAddDraft({ name: '', status: 'A' })
  }

  const handleUpdateCategory = async (category: UserExpenseCategory) => {
    if (!loginUsername || !categoryDraft) return
    const trimmedName = categoryDraft.name.trim()
    if (!trimmedName) {
      setStatus({ type: 'error', message: 'Category name is required.' })
      return
    }
    setCategoryActionInFlight(true)
    setStatus({ type: 'loading', message: 'Updating category…' })
    try {
      await updateUserExpenseCategory({
        username: loginUsername,
        id: category.userExpenseCategoryId,
        userExpenseCategoryName: trimmedName,
        status: categoryDraft.status,
      })
      setStatus({ type: 'success', message: 'Category updated.' })
      cancelEdit()
      await refreshUserCategories()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    } finally {
      setCategoryActionInFlight(false)
    }
  }

  const handleDeleteCategory = async (category: UserExpenseCategory) => {
    if (!loginUsername) return
    const confirmDelete = window.confirm(`Delete the category "${category.userExpenseCategoryName}"?`)
    if (!confirmDelete) return
    setCategoryActionInFlight(true)
    setStatus({ type: 'loading', message: 'Deleting category…' })
    try {
      await deleteUserExpenseCategory({ username: loginUsername, id: category.userExpenseCategoryId })
      setStatus({ type: 'success', message: 'Category deleted.' })
      await refreshUserCategories()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    } finally {
      setCategoryActionInFlight(false)
    }
  }

  const handleAddCategory = async () => {
    if (!loginUsername) return
    const trimmedName = categoryAddDraft.name.trim()
    if (!trimmedName) {
      setStatus({ type: 'error', message: 'Category name is required.' })
      return
    }
    setCategoryActionInFlight(true)
    setStatus({ type: 'loading', message: 'Adding category…' })
    try {
      await createUserExpenseCategory({
        username: loginUsername,
        userExpenseCategoryName: trimmedName,
        status: categoryAddDraft.status,
      })
      setStatus({ type: 'success', message: 'Category added.' })
      cancelAddCategory()
      await refreshUserCategories()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    } finally {
      setCategoryActionInFlight(false)
    }
  }

  const handleResetDefaults = async () => {
    if (!loginUsername) return
    const confirmed = window.confirm(
      'All current categories will be replaced with the default categories. This action cannot be undone. Continue?',
    )
    if (!confirmed) return
    setCategoryActionInFlight(true)
    setStatus({ type: 'loading', message: 'Resetting categories…' })
    try {
      await copyUserExpenseCategoriesFromMaster(loginUsername)
      setStatus({ type: 'success', message: 'Categories reset to defaults.' })
      cancelEdit()
      cancelAddCategory()
      await refreshUserCategories()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    } finally {
      setCategoryActionInFlight(false)
    }
  }

  const handleFontSizeChange = async (size: FontSize) => {
    await setFontSize(size)
    const label = FONT_SIZE_OPTIONS.find(o => o.code === size)?.label || size
    setStatus({ type: 'success', message: `Font size changed to ${label}` })
  }

  const handleCurrencyChange = async (code: CurrencyCode) => {
    await setCurrencyCode(code)
    const option = CURRENCY_OPTIONS.find(o => o.code === code)
    setStatus({ type: 'success', message: `Currency changed to ${option?.name || code} (${option?.symbol})` })
  }

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme)
    setStatus({ type: 'success', message: `Theme changed to ${newTheme === 'light' ? 'Light' : 'Dark'}` })
  }

  const startExpenseEdit = (expense: UserExpense) => {
    setEditingExpenseId(expense.userExpensesId)
    // Preserve the currently assigned category when entering edit mode.
    // If the expense record doesn't include a category id, try to resolve one
    // by matching the category name against the loaded categories list.
    const explicitCategoryId = expense.userExpenseCategoryId
    let resolvedCategoryId: string = ''
    if (explicitCategoryId !== undefined && explicitCategoryId !== null) {
      resolvedCategoryId = String(explicitCategoryId)
    } else if (expense.userExpenseCategoryName) {
      const match = categories.find(
        (c) => c.userExpenseCategoryName.trim().toLowerCase() === expense.userExpenseCategoryName!.trim().toLowerCase(),
      )
      if (match) resolvedCategoryId = String(match.userExpenseCategoryId)
    }

    setExpenseDraft({
      name: expense.userExpenseName,
      status: expense.status,
      categoryId: resolvedCategoryId,
      amount: toAmountString(expense.amount),
    })
  }

  const cancelExpenseEdit = () => {
    setEditingExpenseId(null)
    setExpenseDraft(null)
  }

  const beginAddExpense = () => {
    setAddingExpense(true)
    setExpenseAddDraft({ name: '', status: 'A', categoryId: '', amount: '' })
  }

  const cancelAddExpense = () => {
    setAddingExpense(false)
    setExpenseAddDraft({ name: '', status: 'A', categoryId: '', amount: '' })
  }

  const handleUpdateExpense = async (expense: UserExpense) => {
    if (!loginUsername || !expenseDraft) return
    const trimmedName = expenseDraft.name.trim()
    if (!trimmedName) {
      setStatus({ type: 'error', message: 'Expense name is required.' })
      return
    }
    if (!expenseDraft.categoryId) {
      setStatus({ type: 'error', message: 'Select a category for the expense.' })
      return
    }
    const selectedCategory = categoryLookup.get(expenseDraft.categoryId)
    if (!selectedCategory) {
      setStatus({ type: 'error', message: 'Selected category is not available.' })
      return
    }
    const amountValue = parseAmount(expenseDraft.amount)
    if (amountValue === null || amountValue <= 0) {
      setStatus({ type: 'error', message: 'Enter a valid amount greater than zero.' })
      return
    }
    setExpenseActionInFlight(true)
    setStatus({ type: 'loading', message: 'Updating expense template…' })
    try {
      await updateUserExpense({
        username: loginUsername,
        id: expense.userExpensesId,
        userExpenseName: trimmedName,
        userExpenseCategoryId: selectedCategory.userExpenseCategoryId,
        amount: amountValue,
        status: expenseDraft.status,
      })
      setStatus({ type: 'success', message: 'Expense template updated.' })
      cancelExpenseEdit()
      await refreshUserExpenses()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    } finally {
      setExpenseActionInFlight(false)
    }
  }

  const handleDeleteExpense = async (expense: UserExpense) => {
    if (!loginUsername) return
    const confirmed = window.confirm(`Delete the expense template "${expense.userExpenseName}"?`)
    if (!confirmed) return
    setExpenseActionInFlight(true)
    setStatus({ type: 'loading', message: 'Deleting expense template…' })
    try {
      await deleteUserExpense({ username: loginUsername, id: expense.userExpensesId })
      setStatus({ type: 'success', message: 'Expense template deleted.' })
      await refreshUserExpenses()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    } finally {
      setExpenseActionInFlight(false)
    }
  }

  const handleAddExpense = async () => {
    if (!loginUsername) return
    const trimmedName = expenseAddDraft.name.trim()
    if (!trimmedName) {
      setStatus({ type: 'error', message: 'Expense name is required.' })
      return
    }
    if (!expenseAddDraft.categoryId) {
      setStatus({ type: 'error', message: 'Select a category for the expense.' })
      return
    }
    const selectedCategory = categoryLookup.get(expenseAddDraft.categoryId)
    if (!selectedCategory || selectedCategory.status !== 'A') {
      setStatus({ type: 'error', message: 'Select an active category before saving.' })
      return
    }
    const amountValue = parseAmount(expenseAddDraft.amount)
    if (amountValue === null || amountValue <= 0) {
      setStatus({ type: 'error', message: 'Enter a valid amount greater than zero.' })
      return
    }
    setExpenseActionInFlight(true)
    setStatus({ type: 'loading', message: 'Adding expense template…' })
    try {
      await createUserExpense({
        username: loginUsername,
        userExpenseName: trimmedName,
        userExpenseCategoryId: selectedCategory.userExpenseCategoryId,
        amount: amountValue,
        status: expenseAddDraft.status,
        paid: 'N',
      })
      setStatus({ type: 'success', message: 'Expense template added.' })
      cancelAddExpense()
      await refreshUserExpenses()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    } finally {
      setExpenseActionInFlight(false)
    }
  }

  const renderStatusToggle = (status: 'A' | 'I', onChange: (next: 'A' | 'I') => void, disabled?: boolean) => (
    <label className={styles.toggle}>
      <input
        type="checkbox"
        checked={status === 'A'}
        onChange={(event) => onChange(event.target.checked ? 'A' : 'I')}
        disabled={disabled}
      />
      <span className={styles.toggleTrack}>
        <span className={styles.toggleThumb} />
      </span>
      <span className={styles.toggleLabel}>{status === 'A' ? 'Active' : 'Inactive'}</span>
    </label>
  )

  function CategoryDropdown({
    value,
    onChange,
    disabled,
  }: {
    value: string
    onChange: (next: string) => void
    disabled?: boolean
  }) {
    const wrapperRef = useRef<HTMLDivElement | null>(null)
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')

    useEffect(() => {
      // reflect externally controlled value into the visible query
      const match = categoryOptions.find((o) => o.id === value)
      setQuery(match ? match.label : '')
    }, [value])

    useEffect(() => {
      if (!open) return
      const handleClickAway = (event: MouseEvent) => {
        if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
          setOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClickAway)
      return () => document.removeEventListener('mousedown', handleClickAway)
    }, [open])

    const suggestions = useMemo(() => {
      const q = (query || '').trim().toLowerCase()
      if (!q) return categoryOptions
      return categoryOptions.filter((c) => c.label.toLowerCase().includes(q))
    }, [query, categoryOptions])

    return (
      <div className={styles.dropdownField} ref={wrapperRef}>
        <input
          className={styles.selectInput}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Select category"
          autoComplete="off"
          disabled={disabled || categoryOptions.length === 0}
        />
        {open && (
          <ul className={styles.dropdownList} role="listbox">
            {suggestions.length === 0 ? (
              <li className={styles.dropdownEmpty}>No categories found</li>
            ) : (
              suggestions.map((option) => (
                <li
                  key={option.id}
                  className={styles.dropdownItem}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onChange(option.id)
                    setOpen(false)
                  }}
                >
                  {option.label}
                  {option.status !== 'A' ? ' (inactive)' : ''}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    )
  }

  const renderCategorySelect = (value: string, onChange: (next: string) => void, disabled?: boolean) => (
    <CategoryDropdown value={value} onChange={onChange} disabled={disabled} />
  )

  const preferenceButtons: { key: PreferenceTab; label: string; icon: string }[] = [
    { key: 'categories', label: 'Expense Categories', icon: '📂' },
    { key: 'expenses', label: 'Planned Expenses', icon: '💰' },
    { key: 'display', label: 'Font Size & Theme', icon: '🎨' },
    { key: 'currency', label: 'Currency', icon: '💱' },
  ]

  return (
    <section className={styles.wrapper}>
      <h2 className={styles.title}>Profile</h2>
      <dl className={styles.details}>
        <div className={styles.row}>
          <dt>Username</dt>
          <dd>{displayUsername || '-'}</dd>
        </div>
        <div className={styles.row}>
          <dt>Email</dt>
          <dd>{email || '-'}</dd>
        </div>
      </dl>

      <div className={styles.primaryActions}>
        <button
          type="button"
          className={styles.resetButton}
          onClick={handleResetPassword}
          disabled={!displayUsername}
        >
          Reset password
        </button>
      </div>

      {/* Your Preferences Section */}
      <section className={styles.preferencesSection}>
        <h3 className={styles.sectionTitle}>Your Preferences</h3>
        <p className={styles.sectionSubtitle}>Customize your experience by managing expense categories, planned expenses, and display settings.</p>

        <div className={styles.preferenceTabs}>
          {preferenceButtons.map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              className={`${styles.preferenceTab} ${activeTab === key ? styles.preferenceTabActive : ''}`}
              onClick={() => setActiveTab(activeTab === key ? null : key)}
              disabled={!loginUsername}
            >
              <span className={styles.preferenceTabIcon}>{icon}</span>
              <span className={styles.preferenceTabLabel}>{label}</span>
              <span className={styles.preferenceTabArrow}>{activeTab === key ? '▲' : '▼'}</span>
            </button>
          ))}
        </div>

        {/* Categories Panel */}
        {activeTab === 'categories' && (
          <div className={styles.preferencePanel}>
            <header className={styles.panelHeader}>
              <div>
                <h4 className={styles.panelTitle}>Your Categories</h4>
                <p className={styles.panelSubtitle}>
                  {categories.length} / {MAX_USER_CATEGORIES} categories
                </p>
              </div>
              <button
                type="button"
                className={styles.cardActionButton}
                onClick={handleResetDefaults}
                disabled={categoryActionInFlight || !canManageCategories}
              >
                Reset default
              </button>
            </header>

            {loadingCategories ? (
              <div style={{padding:12}}>
                {[0,1,2].map((i) => (
                  <div key={i} style={{display:'flex',gap:12,alignItems:'center',marginBottom:10}}>
                    <div style={{width:40}}><Skeleton /></div>
                    <div style={{flex:1}}><Skeleton /></div>
                    <div style={{width:120}}><Skeleton /></div>
                  </div>
                ))}
              </div>
            ) : categories.length === 0 && !addingCategory ? (
              <p className={styles.placeholder}>No categories yet. Add your first category below.</p>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Category</th>
                      <th scope="col" className={styles.statusCol}>Status</th>
                      <th scope="col" className={styles.actionsCol}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoriesWithSerial.map((category) => {
                      const isEditing = editingCategoryId === category.userExpenseCategoryId
                      const draft = isEditing ? categoryDraft : null
                      return (
                        <tr key={category.userExpenseCategoryId}>
                          <td>{category.serial}</td>
                          <td>
                            {isEditing ? (
                              <input
                                className={styles.inlineInput}
                                value={draft?.name ?? ''}
                                onChange={(event) =>
                                  setCategoryDraft((previous) =>
                                    previous ? { ...previous, name: event.target.value } : previous,
                                  )
                                }
                                placeholder="Category name"
                                maxLength={60}
                                disabled={categoryActionInFlight}
                              />
                            ) : (
                              category.userExpenseCategoryName
                            )}
                          </td>
                          <td>
                            {isEditing
                              ? renderStatusToggle(
                                  draft?.status ?? 'A',
                                  (next) =>
                                    setCategoryDraft((previous) =>
                                      previous ? { ...previous, status: next } : previous,
                                    ),
                                  categoryActionInFlight,
                                )
                              : renderStatusToggle(category.status, () => undefined, true)}
                          </td>
                          <td className={styles.actionsCell}>
                            {isEditing ? (
                              <div className={styles.inlineActions}>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCategory(category)}
                                  disabled={categoryActionInFlight}
                                >
                                  Save
                                </button>
                                <button type="button" onClick={cancelEdit} disabled={categoryActionInFlight}>
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className={styles.inlineActions}>
                                <button
                                  type="button"
                                  onClick={() => startEdit(category)}
                                  disabled={categoryActionInFlight}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(category)}
                                  disabled={categoryActionInFlight}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}

                    {addingCategory && (
                      <tr>
                        <td>{categories.length + 1}</td>
                        <td>
                          <input
                            className={styles.inlineInput}
                            value={categoryAddDraft.name}
                            onChange={(event) =>
                              setCategoryAddDraft((previous) => ({ ...previous, name: event.target.value }))
                            }
                            placeholder="Category name"
                            maxLength={60}
                            disabled={categoryActionInFlight}
                            autoFocus
                          />
                        </td>
                        <td>
                          {renderStatusToggle(
                            categoryAddDraft.status,
                            (next) => setCategoryAddDraft((prev) => ({ ...prev, status: next })),
                            categoryActionInFlight,
                          )}
                        </td>
                        <td className={styles.actionsCell}>
                          <div className={styles.inlineActions}>
                            <button type="button" onClick={handleAddCategory} disabled={categoryActionInFlight}>
                              Save
                            </button>
                            <button type="button" onClick={cancelAddCategory} disabled={categoryActionInFlight}>
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {!categoryLimitReached && !addingCategory && (
              <button
                type="button"
                className={styles.addButton}
                onClick={beginAddCategory}
                disabled={categoryActionInFlight}
              >
                Add category
              </button>
            )}

            {categoryLimitReached && !addingCategory && (
              <p className={styles.limitNote}>Maximum of {MAX_USER_CATEGORIES} categories reached.</p>
            )}
          </div>
        )}

        {/* Expenses Panel */}
        {activeTab === 'expenses' && (
          <div className={styles.preferencePanel}>
            <header className={styles.panelHeader}>
              <div>
                <h4 className={styles.panelTitle}>Planned Expenses</h4>
                <p className={styles.panelSubtitle}>
                  {expenses.length} / {MAX_USER_EXPENSES} templates
                </p>
              </div>
              <span className={styles.headerHint}>Active categories: {activeCategories.length}</span>
            </header>

            {!hasActiveCategory && expenses.length === 0 && (
              <p className={styles.helperNote}>
                Activate at least one category before adding expense templates.
              </p>
            )}

            {loadingExpenses ? (
              <div style={{padding:12}}>
                {[0,1,2].map((i) => (
                  <div key={i} style={{display:'flex',gap:12,alignItems:'center',marginBottom:10}}>
                    <div style={{width:40}}><Skeleton /></div>
                    <div style={{flex:1}}><Skeleton /></div>
                    <div style={{width:120}}><Skeleton /></div>
                    <div style={{width:80}}><Skeleton /></div>
                  </div>
                ))}
              </div>
            ) : expenses.length === 0 && !addingExpense ? (
              <p className={styles.placeholder}>No expense templates yet. Add your first template below.</p>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Expense</th>
                      <th scope="col">Category</th>
                      <th scope="col" className={styles.amountCol}>Amount</th>
                      <th scope="col" className={styles.statusCol}>Status</th>
                      <th scope="col" className={styles.actionsCol}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expensesWithSerial.map((expense) => {
                      const isEditing = editingExpenseId === expense.userExpensesId
                      const draft = isEditing ? expenseDraft : null
                      return (
                        <tr key={expense.userExpensesId}>
                          <td>{expense.serial}</td>
                          <td>
                            {isEditing ? (
                              <input
                                className={styles.inlineInput}
                                value={draft?.name ?? ''}
                                onChange={(event) =>
                                  setExpenseDraft((previous) =>
                                    previous ? { ...previous, name: event.target.value } : previous,
                                  )
                                }
                                placeholder="Expense name"
                                maxLength={80}
                                disabled={expenseActionInFlight}
                              />
                            ) : (
                              expense.userExpenseName
                            )}
                          </td>
                          <td>
                            {isEditing
                              ? renderCategorySelect(
                                  draft?.categoryId ?? '',
                                  (next) =>
                                    setExpenseDraft((previous) =>
                                      previous ? { ...previous, categoryId: next } : previous,
                                    ),
                                  expenseActionInFlight,
                                )
                              : expense.userExpenseCategoryName || '-'}
                          </td>
                          <td className={styles.numericCell}>
                            {isEditing ? (
                              <input
                                className={styles.numberInput}
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.01"
                                value={draft?.amount ?? ''}
                                onChange={(event) =>
                                  setExpenseDraft((previous) =>
                                    previous ? { ...previous, amount: event.target.value } : previous,
                                  )
                                }
                                placeholder="0.00"
                                disabled={expenseActionInFlight}
                              />
                            ) : (
                              formatAmountDisplay(expense.amount)
                            )}
                          </td>
                          <td>
                            {isEditing
                              ? renderStatusToggle(
                                  draft?.status ?? 'A',
                                  (next) =>
                                    setExpenseDraft((previous) =>
                                      previous ? { ...previous, status: next } : previous,
                                    ),
                                  expenseActionInFlight,
                                )
                              : renderStatusToggle(expense.status, () => undefined, true)}
                          </td>
                          <td className={styles.actionsCell}>
                            {isEditing ? (
                              <div className={styles.inlineActions}>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateExpense(expense)}
                                  disabled={expenseActionInFlight}
                                >
                                  Save
                                </button>
                                <button type="button" onClick={cancelExpenseEdit} disabled={expenseActionInFlight}>
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className={styles.inlineActions}>
                                <button
                                  type="button"
                                  onClick={() => startExpenseEdit(expense)}
                                  disabled={expenseActionInFlight}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExpense(expense)}
                                  disabled={expenseActionInFlight}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}

                    {addingExpense && (
                      <tr>
                        <td>{expenses.length + 1}</td>
                        <td>
                          <input
                            className={styles.inlineInput}
                            value={expenseAddDraft.name}
                            onChange={(event) =>
                              setExpenseAddDraft((previous) => ({ ...previous, name: event.target.value }))
                            }
                            placeholder="Expense name"
                            maxLength={80}
                            disabled={expenseActionInFlight}
                            autoFocus
                          />
                        </td>
                        <td>
                          {renderCategorySelect(
                            expenseAddDraft.categoryId,
                            (next) => setExpenseAddDraft((previous) => ({ ...previous, categoryId: next })),
                            expenseActionInFlight,
                          )}
                        </td>
                        <td className={styles.numericCell}>
                          <input
                            className={styles.numberInput}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={expenseAddDraft.amount}
                            onChange={(event) =>
                              setExpenseAddDraft((previous) => ({ ...previous, amount: event.target.value }))
                            }
                            placeholder="0.00"
                            disabled={expenseActionInFlight}
                          />
                        </td>
                        <td>
                          {renderStatusToggle(
                            expenseAddDraft.status,
                            (next) => setExpenseAddDraft((prev) => ({ ...prev, status: next })),
                            expenseActionInFlight,
                          )}
                        </td>
                        <td className={styles.actionsCell}>
                          <div className={styles.inlineActions}>
                            <button
                              type="button"
                              onClick={handleAddExpense}
                              disabled={expenseActionInFlight || !hasActiveCategory}
                            >
                              Save
                            </button>
                            <button type="button" onClick={cancelAddExpense} disabled={expenseActionInFlight}>
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {!expenseLimitReached && !addingExpense && (
              <button
                type="button"
                className={styles.addButton}
                onClick={beginAddExpense}
                disabled={expenseActionInFlight || !hasActiveCategory}
              >
                Add expense template
              </button>
            )}

            {expenseLimitReached && !addingExpense && (
              <p className={styles.limitNote}>Maximum of {MAX_USER_EXPENSES} expense templates reached.</p>
            )}

            {!hasActiveCategory && expenses.length > 0 && (
              <p className={styles.helperNote}>Activate a category to add new expense templates.</p>
            )}
          </div>
        )}

        {/* Display Settings Panel */}
        {activeTab === 'display' && (
          <div className={styles.preferencePanel}>
            <header className={styles.panelHeader}>
              <div>
                <h4 className={styles.panelTitle}>Display Settings</h4>
                <p className={styles.panelSubtitle}>Customize font size and theme appearance</p>
              </div>
            </header>

            <div className={styles.settingsGrid}>
              {/* Font Size Setting */}
              <div className={styles.settingItem}>
                <label className={styles.settingLabel}>Font Size</label>
                <p className={styles.settingDescription}>Adjust the text size across the application</p>
                <div className={styles.optionGroup}>
                  {FONT_SIZE_OPTIONS.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      className={`${styles.optionButton} ${fontSize === option.code ? styles.optionButtonActive : ''}`}
                      onClick={() => handleFontSizeChange(option.code)}
                    >
                      <span className={styles.optionLabel}>{option.label}</span>
                      {fontSize === option.code && <span className={styles.checkmark}>✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme Setting */}
              <div className={styles.settingItem}>
                <label className={styles.settingLabel}>Theme</label>
                <p className={styles.settingDescription}>Switch between light and dark mode</p>
                <div className={styles.themeToggleContainer}>
                  <button
                    type="button"
                    className={`${styles.themeButton} ${theme === 'light' ? styles.themeButtonActive : ''}`}
                    onClick={() => theme !== 'light' && handleThemeChange('light')}
                  >
                    <span className={styles.themeIcon}>☀️</span>
                    <span>Light</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.themeButton} ${theme === 'dark' ? styles.themeButtonActive : ''}`}
                    onClick={() => theme !== 'dark' && handleThemeChange('dark')}
                  >
                    <span className={styles.themeIcon}>🌙</span>
                    <span>Dark</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Currency Panel */}
        {activeTab === 'currency' && (
          <div className={styles.preferencePanel}>
            <header className={styles.panelHeader}>
              <div>
                <h4 className={styles.panelTitle}>Currency Settings</h4>
                <p className={styles.panelSubtitle}>Choose your preferred currency for displaying amounts</p>
              </div>
            </header>

            <div className={styles.currencyGrid}>
              {CURRENCY_OPTIONS.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  className={`${styles.currencyOption} ${currencyCode === option.code ? styles.currencyOptionActive : ''}`}
                  onClick={() => handleCurrencyChange(option.code)}
                >
                  <span className={styles.currencySymbol}>{option.symbol}</span>
                  <div className={styles.currencyInfo}>
                    <span className={styles.currencyCode}>{option.code}</span>
                    <span className={styles.currencyName}>{option.name}</span>
                  </div>
                  {currencyCode === option.code && <span className={styles.currencyCheck}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </section>
  )
}
