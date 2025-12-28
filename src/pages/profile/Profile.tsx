import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import {
  User,
  Mail,
  CreditCard,
  Settings,
  Palette,
  Tag,
  Wallet,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  RefreshCw,
  Moon,
  Sun,
  Crown,
} from 'lucide-react'
import { useAppDataContext } from '../../context/AppDataContext'
import { usePreferences } from '../../context/PreferencesContext'
import { useTheme } from '../../context/ThemeContext'
import type { SessionData, UserExpenseCategory, UserExpense, FontSize, CurrencyCode } from '../../types/app'
import { CURRENCY_OPTIONS, FONT_SIZE_OPTIONS } from '../../types/app'
import {
  copyUserExpenseCategoriesFromMaster,
  copyUserExpensesFromMaster,
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
import { friendlyErrorMessage } from '../../utils/format'

type ProfileProps = {
  session: SessionData | null
}

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

export default function Profile({ session }: ProfileProps): ReactElement {
  // Get user details from session (populated from cookies)
  const userId = session?.userId ?? ''
  const displayUsername = session?.username ?? userId
  const email = session?.email ?? ''
  const subscription = session?.subscription

  const {
    setStatus,
    expenseCategories: activeCategories,
    ensureExpenseCategories,
    refreshExpenseCategories,
    ensureUserExpenses,
    ensureActiveUserExpenses,
    refreshActiveUserExpenses,
  } = useAppDataContext()

  const {
    fontSize,
    currencyCode,
    setFontSize,
    setCurrencyCode,
    formatCurrency,
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

  const canManageCategories = Boolean(userId)
  const canManageExpenses = Boolean(userId)

  const formatAmountDisplay = useCallback(
    (value: number | string | undefined): string => {
      const numeric = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(numeric)) {
        return '-'
      }
      return formatCurrency(numeric)
    },
    [formatCurrency],
  )

  const categoryLookup = useMemo(() => {
    const map = new Map<string, UserExpenseCategory>()
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
    if (!userId) return
    try {
      await refreshExpenseCategories()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'loading categories') })
    }
  }, [refreshExpenseCategories, userId, setStatus])

  const refreshUserCategories = useCallback(async () => {
    if (!userId) return
    setLoadingCategories(true)
    try {
      const allCategories = await fetchUserExpenseCategories(userId)
      setCategories(allCategories)
      await syncActiveCategories()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'loading categories') })
    } finally {
      setLoadingCategories(false)
    }
  }, [userId, setStatus, syncActiveCategories])

  const syncActiveExpenses = useCallback(async () => {
    if (!userId) return
    try {
      await refreshActiveUserExpenses()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'loading planned expenses') })
    }
  }, [refreshActiveUserExpenses, userId, setStatus])

  const refreshUserExpenses = useCallback(async () => {
    if (!userId) return
    setLoadingExpenses(true)
    try {
      const allExpenses = await ensureUserExpenses()
      setExpenses(allExpenses)
      await syncActiveExpenses()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'loading planned expenses') })
    } finally {
      setLoadingExpenses(false)
    }
  }, [ensureUserExpenses, userId, setStatus, syncActiveExpenses])

  const handleResetCategories = async () => {
    if (!userId) return
    const confirmed = window.confirm(
      'All current categories will be replaced with the default templates. This action cannot be undone. Continue?',
    )
    if (!confirmed) return
    setCategoryActionInFlight(true)
    setStatus({ type: 'loading', message: 'Resetting categories…' })
    try {
      await copyUserExpenseCategoriesFromMaster(userId)
      setStatus({ type: 'success', message: 'Categories reset to defaults.' })
      cancelEdit()
      cancelAddCategory()
      await refreshUserCategories()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'resetting categories') })
    } finally {
      setCategoryActionInFlight(false)
    }
  }

  const handleResetExpenses = async () => {
    if (!userId) return
    const confirmed = window.confirm(
      'All current planned expenses will be replaced with the default templates. This action cannot be undone. Continue?',
    )
    if (!confirmed) return
    setExpenseActionInFlight(true)
    setStatus({ type: 'loading', message: 'Resetting planned expenses…' })
    try {
      await copyUserExpensesFromMaster(userId)
      setStatus({ type: 'success', message: 'Planned expenses reset to defaults.' })
      cancelExpenseEdit()
      cancelAddExpense()
      await refreshUserExpenses()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'resetting planned expenses') })
    } finally {
      setExpenseActionInFlight(false)
    }
  }

  useEffect(() => {
    if (userId) {
      void refreshUserCategories()
      // Also load expenses on mount so the badge count is accurate
      void refreshUserExpenses()
    }
  }, [userId, refreshUserCategories, refreshUserExpenses])

  useEffect(() => {
    if (activeTab === 'categories' && userId) {
      void refreshUserCategories()
    }
  }, [activeTab, userId, refreshUserCategories])

  useEffect(() => {
    if (activeTab === 'expenses' && userId) {
      void refreshUserExpenses()
    }
  }, [activeTab, userId, refreshUserExpenses])

  useEffect(() => {
    if (!userId) {
      setActiveTab(null)
      setCategories([])
      setExpenses([])
    }
  }, [userId])

  // Category management
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
    if (!userId || !categoryDraft) return
    const trimmedName = categoryDraft.name.trim()
    if (!trimmedName) {
      setStatus({ type: 'error', message: 'Category name is required.' })
      return
    }
    setCategoryActionInFlight(true)
    setStatus({ type: 'loading', message: 'Updating category…' })
    try {
      await updateUserExpenseCategory({
        userId,
        id: category.userExpenseCategoryId,
        userExpenseCategoryName: trimmedName,
        status: categoryDraft.status,
      })
      setStatus({ type: 'success', message: 'Category updated.' })
      cancelEdit()
      await refreshUserCategories()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'updating category') })
    } finally {
      setCategoryActionInFlight(false)
    }
  }

  const handleDeleteCategory = async (category: UserExpenseCategory) => {
    if (!userId) return
    const confirmDelete = window.confirm(`Delete the category "${category.userExpenseCategoryName}"?`)
    if (!confirmDelete) return
    setCategoryActionInFlight(true)
    setStatus({ type: 'loading', message: 'Deleting category…' })
    try {
      await deleteUserExpenseCategory({ userId, id: category.userExpenseCategoryId })
      setStatus({ type: 'success', message: 'Category deleted.' })
      await refreshUserCategories()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'deleting category') })
    } finally {
      setCategoryActionInFlight(false)
    }
  }

  const handleAddCategory = async () => {
    if (!userId) return
    const trimmedName = categoryAddDraft.name.trim()
    if (!trimmedName) {
      setStatus({ type: 'error', message: 'Category name is required.' })
      return
    }
    setCategoryActionInFlight(true)
    setStatus({ type: 'loading', message: 'Adding category…' })
    try {
      await createUserExpenseCategory({
        userId,
        userExpenseCategoryName: trimmedName,
        status: categoryAddDraft.status,
      })
      setStatus({ type: 'success', message: 'Category added.' })
      cancelAddCategory()
      await refreshUserCategories()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'adding category') })
    } finally {
      setCategoryActionInFlight(false)
    }
  }

  // Expense management
  const startExpenseEdit = (expense: UserExpense) => {
    setEditingExpenseId(expense.userExpensesId)
    setExpenseDraft({
      name: expense.userExpenseName,
      status: expense.status,
      categoryId: String(expense.userExpenseCategoryId ?? ''),
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
    if (!userId || !expenseDraft) return
    const trimmedName = expenseDraft.name.trim()
    if (!trimmedName) {
      setStatus({ type: 'error', message: 'Expense name is required.' })
      return
    }
    const amount = parseAmount(expenseDraft.amount)
    if (amount === null) {
      setStatus({ type: 'error', message: 'Valid amount is required.' })
      return
    }
    setExpenseActionInFlight(true)
    setStatus({ type: 'loading', message: 'Updating planned expense…' })
    try {
      await updateUserExpense({
        userId,
        id: expense.userExpensesId,
        userExpenseName: trimmedName,
        userExpenseCategoryId: expenseDraft.categoryId || expense.userExpenseCategoryId,
        amount,
        status: expenseDraft.status,
      })
      setStatus({ type: 'success', message: 'Planned expense updated.' })
      cancelExpenseEdit()
      await refreshUserExpenses()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'updating planned expense') })
    } finally {
      setExpenseActionInFlight(false)
    }
  }

  const handleDeleteExpense = async (expense: UserExpense) => {
    if (!userId) return
    const confirmDelete = window.confirm(`Delete the planned expense "${expense.userExpenseName}"?`)
    if (!confirmDelete) return
    setExpenseActionInFlight(true)
    setStatus({ type: 'loading', message: 'Deleting planned expense…' })
    try {
      await deleteUserExpense({ userId, id: expense.userExpensesId })
      setStatus({ type: 'success', message: 'Planned expense deleted.' })
      await refreshUserExpenses()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'deleting planned expense') })
    } finally {
      setExpenseActionInFlight(false)
    }
  }

  const handleAddExpense = async () => {
    if (!userId) return
    const trimmedName = expenseAddDraft.name.trim()
    if (!trimmedName) {
      setStatus({ type: 'error', message: 'Expense name is required.' })
      return
    }
    if (!expenseAddDraft.categoryId) {
      setStatus({ type: 'error', message: 'Category is required.' })
      return
    }
    const amount = parseAmount(expenseAddDraft.amount)
    if (amount === null) {
      setStatus({ type: 'error', message: 'Valid amount is required.' })
      return
    }
    setExpenseActionInFlight(true)
    setStatus({ type: 'loading', message: 'Adding planned expense…' })
    try {
      await createUserExpense({
        userId,
        userExpenseName: trimmedName,
        userExpenseCategoryId: expenseAddDraft.categoryId,
        amount,
        status: expenseAddDraft.status,
      })
      setStatus({ type: 'success', message: 'Planned expense added.' })
      cancelAddExpense()
      await refreshUserExpenses()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'adding planned expense') })
    } finally {
      setExpenseActionInFlight(false)
    }
  }

  return (
    <div className={styles.profilePage}>
      {/* User Info Card */}
      <section className={styles.userCard}>
        <div className={styles.avatarSection}>
          <div className={styles.avatar}>
            <User size={40} />
          </div>
          <div className={styles.userInfo}>
            <h1 className={styles.userName}>{displayUsername}</h1>
            {email && (
              <div className={styles.userDetail}>
                <Mail size={14} />
                <span>{email}</span>
              </div>
            )}
            {subscription && (
              <div className={styles.subscriptionBadge}>
                <Crown size={14} />
                <span>{subscription.plan || 'Free'}</span>
                {subscription.status && (
                  <span className={`${styles.statusDot} ${styles[subscription.status]}`} />
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Settings Sections */}
      <section className={styles.settingsSection}>
        <h2 className={styles.sectionTitle}>
          <Settings size={20} />
          <span>Settings</span>
        </h2>

        <div className={styles.settingsGrid}>
          <div className={styles.rowTwo}>
            {/* Theme Toggle */}
            <div className={styles.settingCard}>
            <div className={styles.settingHeader}>
              <Palette size={20} />
              <span>Theme</span>
            </div>
            <div className={styles.themeToggle}>
              <button
                type="button"
                className={`${styles.themeButton} ${theme === 'light' ? styles.active : ''}`}
                onClick={() => setTheme('light')}
              >
                <Sun size={16} />
                <span>Light</span>
              </button>
              <button
                type="button"
                className={`${styles.themeButton} ${theme === 'dark' ? styles.active : ''}`}
                onClick={() => setTheme('dark')}
              >
                <Moon size={16} />
                <span>Dark</span>
              </button>
            </div>
          </div>

            {/* Font Size */}
            <div className={styles.settingCard}>
            <div className={styles.settingHeader}>
              <span className={styles.textIcon}>Aa</span>
              <span>Font Size</span>
            </div>
            <div className={styles.fontSizeOptions}>
              {FONT_SIZE_OPTIONS.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  className={`${styles.fontSizeButton} ${fontSize === option.code ? styles.active : ''}`}
                  onClick={() => setFontSize(option.code)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          </div>
          {/* Currency */}
          <div className={`${styles.settingCard} ${styles.currencyCard}`}>
            <div className={styles.settingHeader}>
              <CreditCard size={20} />
              <span>Currency</span>
            </div>
            <div className={styles.currencyGrid}>
              {CURRENCY_OPTIONS.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  className={`${styles.currencyBlock} ${currencyCode === option.code ? styles.active : ''}`}
                  onClick={() => setCurrencyCode(option.code)}
                >
                  <span className={styles.currencySymbol}>{option.symbol}</span>
                  <span className={styles.currencyName}>{option.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Expense Categories Section */}
      <section className={styles.managementSection}>
        <button
          type="button"
          className={`${styles.sectionHeader} ${activeTab === 'categories' ? styles.expanded : ''}`}
          onClick={() => setActiveTab(activeTab === 'categories' ? null : 'categories')}
        >
          <div className={styles.sectionHeaderContent}>
            <Tag size={20} />
            <span>Expense Categories</span>
            <span className={styles.badge}>{categories.length}</span>
          </div>
          <ChevronRight size={20} className={styles.chevron} />
        </button>

        {activeTab === 'categories' && (
          <div className={styles.sectionContent}>
            <div className={styles.actionBar}>
              <button
                type="button"
                className={styles.addButton}
                onClick={beginAddCategory}
                disabled={!canManageCategories || categoryLimitReached || categoryActionInFlight}
              >
                <Plus size={16} />
                <span>Add Category</span>
              </button>
              <button
                type="button"
                className={styles.resetButton}
                onClick={handleResetCategories}
                disabled={!canManageCategories || categoryActionInFlight}
              >
                <RefreshCw size={16} />
                <span>Reset to Defaults</span>
              </button>
            </div>

            {addingCategory && (
              <div className={styles.addForm}>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Category name"
                  value={categoryAddDraft.name}
                  onChange={(e) => setCategoryAddDraft({ ...categoryAddDraft, name: e.target.value })}
                />
                <select
                  className={styles.select}
                  value={categoryAddDraft.status}
                  onChange={(e) => setCategoryAddDraft({ ...categoryAddDraft, status: e.target.value as 'A' | 'I' })}
                >
                  <option value="A">Active</option>
                  <option value="I">Inactive</option>
                </select>
                <div className={styles.formActions}>
                  <button type="button" className={styles.saveButton} onClick={handleAddCategory} disabled={categoryActionInFlight}>
                    <Check size={16} />
                  </button>
                  <button type="button" className={styles.cancelButton} onClick={cancelAddCategory}>
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            {loadingCategories ? (
              <div className={styles.loadingList}>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} size="large" />
                ))}
              </div>
            ) : (
              <div className={styles.itemList}>
                {categoriesWithSerial.map((category) => (
                  <div key={category.userExpenseCategoryId} className={styles.item}>
                    {editingCategoryId === category.userExpenseCategoryId ? (
                      <>
                        <input
                          type="text"
                          className={styles.input}
                          value={categoryDraft?.name ?? ''}
                          onChange={(e) => setCategoryDraft({ ...categoryDraft!, name: e.target.value })}
                        />
                        <select
                          className={styles.select}
                          value={categoryDraft?.status ?? 'A'}
                          onChange={(e) => setCategoryDraft({ ...categoryDraft!, status: e.target.value as 'A' | 'I' })}
                        >
                          <option value="A">Active</option>
                          <option value="I">Inactive</option>
                        </select>
                        <div className={styles.itemActions}>
                          <button type="button" className={styles.saveButton} onClick={() => handleUpdateCategory(category)} disabled={categoryActionInFlight}>
                            <Check size={16} />
                          </button>
                          <button type="button" className={styles.cancelButton} onClick={cancelEdit}>
                            <X size={16} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className={styles.itemName}>{category.userExpenseCategoryName}</span>
                        <span className={`${styles.statusBadge} ${category.status === 'A' ? styles.active : styles.inactive}`}>
                          {category.status === 'A' ? 'Active' : 'Inactive'}
                        </span>
                        <div className={styles.itemActions}>
                          <button type="button" className={styles.editButton} onClick={() => startEdit(category)} disabled={categoryActionInFlight}>
                            <Pencil size={14} />
                          </button>
                          <button type="button" className={styles.deleteButton} onClick={() => handleDeleteCategory(category)} disabled={categoryActionInFlight}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {categoriesWithSerial.length === 0 && !loadingCategories && (
                  <p className={styles.emptyText}>No categories found. Add one or reset to defaults.</p>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Planned Expenses Section */}
      <section className={styles.managementSection}>
        <button
          type="button"
          className={`${styles.sectionHeader} ${activeTab === 'expenses' ? styles.expanded : ''}`}
          onClick={() => setActiveTab(activeTab === 'expenses' ? null : 'expenses')}
        >
          <div className={styles.sectionHeaderContent}>
            <Wallet size={20} />
            <span>Planned Expenses</span>
            <span className={styles.badge}>{expenses.length}</span>
          </div>
          <ChevronRight size={20} className={styles.chevron} />
        </button>

        {activeTab === 'expenses' && (
          <div className={styles.sectionContent}>
            <div className={styles.actionBar}>
              <button
                type="button"
                className={styles.addButton}
                onClick={beginAddExpense}
                disabled={!canManageExpenses || expenseLimitReached || expenseActionInFlight || !hasActiveCategory}
              >
                <Plus size={16} />
                <span>Add Expense</span>
              </button>
              <button
                type="button"
                className={styles.resetButton}
                onClick={handleResetExpenses}
                disabled={!canManageExpenses || expenseActionInFlight}
              >
                <RefreshCw size={16} />
                <span>Reset to Defaults</span>
              </button>
            </div>

            {!hasActiveCategory && (
              <p className={styles.warningText}>Create at least one active category before adding expenses.</p>
            )}

            {addingExpense && hasActiveCategory && (
              <div className={styles.addForm}>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Expense name"
                  value={expenseAddDraft.name}
                  onChange={(e) => setExpenseAddDraft({ ...expenseAddDraft, name: e.target.value })}
                />
                <select
                  className={styles.select}
                  value={expenseAddDraft.categoryId}
                  onChange={(e) => setExpenseAddDraft({ ...expenseAddDraft, categoryId: e.target.value })}
                >
                  <option value="">Select category</option>
                  {categoryOptions.filter(o => o.status === 'A').map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className={styles.input}
                  placeholder="Amount"
                  value={expenseAddDraft.amount}
                  onChange={(e) => setExpenseAddDraft({ ...expenseAddDraft, amount: e.target.value })}
                />
                <select
                  className={styles.select}
                  value={expenseAddDraft.status}
                  onChange={(e) => setExpenseAddDraft({ ...expenseAddDraft, status: e.target.value as 'A' | 'I' })}
                >
                  <option value="A">Active</option>
                  <option value="I">Inactive</option>
                </select>
                <div className={styles.formActions}>
                  <button type="button" className={styles.saveButton} onClick={handleAddExpense} disabled={expenseActionInFlight}>
                    <Check size={16} />
                  </button>
                  <button type="button" className={styles.cancelButton} onClick={cancelAddExpense}>
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            {loadingExpenses ? (
              <div className={styles.loadingList}>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} size="large" />
                ))}
              </div>
            ) : (
              <div className={styles.itemList}>
                {expensesWithSerial.map((expense) => (
                  <div key={expense.userExpensesId} className={styles.item}>
                    {editingExpenseId === expense.userExpensesId ? (
                      <>
                        <input
                          type="text"
                          className={styles.input}
                          value={expenseDraft?.name ?? ''}
                          onChange={(e) => setExpenseDraft({ ...expenseDraft!, name: e.target.value })}
                        />
                        <select
                          className={styles.select}
                          value={expenseDraft?.categoryId ?? ''}
                          onChange={(e) => setExpenseDraft({ ...expenseDraft!, categoryId: e.target.value })}
                        >
                          {categoryOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          className={styles.input}
                          value={expenseDraft?.amount ?? ''}
                          onChange={(e) => setExpenseDraft({ ...expenseDraft!, amount: e.target.value })}
                        />
                        <select
                          className={styles.select}
                          value={expenseDraft?.status ?? 'A'}
                          onChange={(e) => setExpenseDraft({ ...expenseDraft!, status: e.target.value as 'A' | 'I' })}
                        >
                          <option value="A">Active</option>
                          <option value="I">Inactive</option>
                        </select>
                        <div className={styles.itemActions}>
                          <button type="button" className={styles.saveButton} onClick={() => handleUpdateExpense(expense)} disabled={expenseActionInFlight}>
                            <Check size={16} />
                          </button>
                          <button type="button" className={styles.cancelButton} onClick={cancelExpenseEdit}>
                            <X size={16} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className={styles.itemName}>{expense.userExpenseName}</span>
                        <span className={styles.categoryName}>{expense.userExpenseCategoryName}</span>
                        <span className={styles.amount}>{formatAmountDisplay(expense.amount)}</span>
                        <span className={`${styles.statusBadge} ${expense.status === 'A' ? styles.active : styles.inactive}`}>
                          {expense.status === 'A' ? 'Active' : 'Inactive'}
                        </span>
                        <div className={styles.itemActions}>
                          <button type="button" className={styles.editButton} onClick={() => startExpenseEdit(expense)} disabled={expenseActionInFlight}>
                            <Pencil size={14} />
                          </button>
                          <button type="button" className={styles.deleteButton} onClick={() => handleDeleteExpense(expense)} disabled={expenseActionInFlight}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {expensesWithSerial.length === 0 && !loadingExpenses && (
                  <p className={styles.emptyText}>No planned expenses found. Add one or reset to defaults.</p>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
