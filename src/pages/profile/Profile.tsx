import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { useAppDataContext } from '../../context/AppDataContext'
import type { SessionData, UserExpenseCategory } from '../../types/app'
import {
  copyUserExpenseCategoriesFromMaster,
  createUserExpenseCategory,
  deleteUserExpenseCategory,
  fetchUserExpenseCategories,
  fetchUserExpenseCategoriesActive,
  updateUserExpenseCategory,
} from '../../api'
import styles from './Profile.module.css'

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

export default function Profile({ session, onRequestReset }: ProfileProps): ReactElement {
  const sessionRecord = asRecord(session)
  const user = asRecord(sessionRecord?.user) ?? {}
  const sessionIdentifier = getString(sessionRecord?.identifier) || (session?.username ?? '')
  const displayUsername = getString(user.username) || getString(user.userName) || sessionIdentifier
  const email = getString(user.email)
  const loginUsername = session?.username ?? ''

  const {
    setStatus,
    setExpenseCategories,
  } = useAppDataContext()

  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false)
  const [categories, setCategories] = useState<UserExpenseCategory[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [actionInFlight, setActionInFlight] = useState(false)
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const [editingDraft, setEditingDraft] = useState<CategoryDraft | null>(null)
  const [adding, setAdding] = useState(false)
  const [addDraft, setAddDraft] = useState<CategoryDraft>({ name: '', status: 'A' })

  const canManageCategories = Boolean(loginUsername)

  const syncActiveCategories = useCallback(async () => {
    if (!loginUsername) return
    try {
  const active = await fetchUserExpenseCategoriesActive(loginUsername)
  setExpenseCategories(active)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    }
  }, [loginUsername, setExpenseCategories, setStatus])

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

  useEffect(() => {
    if (categoryEditorOpen) {
      void refreshUserCategories()
    }
  }, [categoryEditorOpen, refreshUserCategories])

  const handleResetPassword = () => {
    if (displayUsername) {
      onRequestReset?.(displayUsername)
    }
  }

  const startEdit = (category: UserExpenseCategory) => {
    setEditingId(category.userExpenseCategoryId)
    setEditingDraft({ name: category.userExpenseCategoryName, status: category.status })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingDraft(null)
  }

  const beginAdd = () => {
    setAdding(true)
    setAddDraft({ name: '', status: 'A' })
  }

  const cancelAdd = () => {
    setAdding(false)
    setAddDraft({ name: '', status: 'A' })
  }

  const handleUpdateCategory = async (category: UserExpenseCategory) => {
    if (!loginUsername || !editingDraft) return
    const trimmedName = editingDraft.name.trim()
    if (!trimmedName) {
      setStatus({ type: 'error', message: 'Category name is required.' })
      return
    }
    setActionInFlight(true)
    setStatus({ type: 'loading', message: 'Updating category…' })
    try {
      await updateUserExpenseCategory({
        username: loginUsername,
        id: category.userExpenseCategoryId,
        userExpenseCategoryName: trimmedName,
        status: editingDraft.status,
      })
      setStatus({ type: 'success', message: 'Category updated.' })
      cancelEdit()
      await refreshUserCategories()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    } finally {
      setActionInFlight(false)
    }
  }

  const handleDeleteCategory = async (category: UserExpenseCategory) => {
    if (!loginUsername) return
    const confirmDelete = window.confirm(`Delete the category "${category.userExpenseCategoryName}"?`)
    if (!confirmDelete) return
    setActionInFlight(true)
    setStatus({ type: 'loading', message: 'Deleting category…' })
    try {
      await deleteUserExpenseCategory({ username: loginUsername, id: category.userExpenseCategoryId })
      setStatus({ type: 'success', message: 'Category deleted.' })
      await refreshUserCategories()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    } finally {
      setActionInFlight(false)
    }
  }

  const handleAddCategory = async () => {
    if (!loginUsername) return
    const trimmedName = addDraft.name.trim()
    if (!trimmedName) {
      setStatus({ type: 'error', message: 'Category name is required.' })
      return
    }
    setActionInFlight(true)
    setStatus({ type: 'loading', message: 'Adding category…' })
    try {
      await createUserExpenseCategory({
        username: loginUsername,
        userExpenseCategoryName: trimmedName,
        status: addDraft.status,
      })
      setStatus({ type: 'success', message: 'Category added.' })
      cancelAdd()
      await refreshUserCategories()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    } finally {
      setActionInFlight(false)
    }
  }

  const handleResetDefaults = async () => {
    if (!loginUsername) return
    const confirmed = window.confirm(
      'All current categories will be replaced with the default categories. This action cannot be undone. Continue?',
    )
    if (!confirmed) return
    setActionInFlight(true)
    setStatus({ type: 'loading', message: 'Resetting categories…' })
    try {
      await copyUserExpenseCategoriesFromMaster(loginUsername)
      setStatus({ type: 'success', message: 'Categories reset to defaults.' })
      cancelEdit()
      cancelAdd()
      await refreshUserCategories()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    } finally {
      setActionInFlight(false)
    }
  }

  const categoriesWithSerial = useMemo(
    () => categories.map((category, index) => ({ ...category, serial: index + 1 })),
    [categories],
  )

  const categoryLimitReached = categories.length >= MAX_USER_CATEGORIES

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
        <button
          type="button"
          className={styles.manageButton}
          onClick={() => setCategoryEditorOpen((previous) => !previous)}
          disabled={!canManageCategories}
        >
          {categoryEditorOpen ? 'Hide categories' : 'Edit user expense categories'}
        </button>
      </div>

      {categoryEditorOpen && (
        <section className={styles.categoryCard}>
          <header className={styles.categoryHeader}>
            <div>
              <h3 className={styles.categoryTitle}>User Categories</h3>
              <p className={styles.categorySubtitle}>
                {categories.length} / {MAX_USER_CATEGORIES} categories
              </p>
            </div>
            <button
              type="button"
              className={styles.resetDefaultsButton}
              onClick={handleResetDefaults}
              disabled={actionInFlight || !canManageCategories}
            >
              Reset Default
            </button>
          </header>

          {loadingCategories ? (
            <p className={styles.placeholder}>Loading categories…</p>
          ) : categories.length === 0 && !adding ? (
            <p className={styles.placeholder}>No categories yet. Add your first category below.</p>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Category</th>
                    <th scope="col">Status</th>
                    <th scope="col" className={styles.actionsCol}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categoriesWithSerial.map((category) => {
                    const isEditing = editingId === category.userExpenseCategoryId
                    const draft = isEditing ? editingDraft : null
                    return (
                      <tr key={category.userExpenseCategoryId}>
                        <td>{category.serial}</td>
                        <td>
                          {isEditing ? (
                            <input
                              className={styles.inlineInput}
                              value={draft?.name ?? ''}
                              onChange={(event) =>
                                setEditingDraft((previous) =>
                                  previous ? { ...previous, name: event.target.value } : previous,
                                )
                              }
                              placeholder="Category name"
                              maxLength={60}
                              disabled={actionInFlight}
                            />
                          ) : (
                            category.userExpenseCategoryName
                          )}
                        </td>
                        <td>
                          {isEditing
                            ? renderStatusToggle(draft?.status ?? 'A', (next) =>
                                setEditingDraft((previous) =>
                                  previous ? { ...previous, status: next } : previous,
                                ), actionInFlight)
                            : renderStatusToggle(category.status, () => undefined, true)}
                        </td>
                        <td className={styles.actionsCell}>
                          {isEditing ? (
                            <div className={styles.inlineActions}>
                              <button
                                type="button"
                                onClick={() => handleUpdateCategory(category)}
                                disabled={actionInFlight}
                              >
                                Save
                              </button>
                              <button type="button" onClick={cancelEdit} disabled={actionInFlight}>
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className={styles.inlineActions}>
                              <button
                                type="button"
                                onClick={() => startEdit(category)}
                                disabled={actionInFlight}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(category)}
                                disabled={actionInFlight}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}

                  {adding && (
                    <tr>
                      <td>{categories.length + 1}</td>
                      <td>
                        <input
                          className={styles.inlineInput}
                          value={addDraft.name}
                          onChange={(event) => setAddDraft((previous) => ({ ...previous, name: event.target.value }))}
                          placeholder="Category name"
                          maxLength={60}
                          disabled={actionInFlight}
                          autoFocus
                        />
                      </td>
                      <td>{renderStatusToggle(addDraft.status, (next) => setAddDraft((prev) => ({ ...prev, status: next })), actionInFlight)}</td>
                      <td className={styles.actionsCell}>
                        <div className={styles.inlineActions}>
                          <button type="button" onClick={handleAddCategory} disabled={actionInFlight}>
                            Save
                          </button>
                          <button type="button" onClick={cancelAdd} disabled={actionInFlight}>
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

          {!categoryLimitReached && !adding && (
            <button
              type="button"
              className={styles.addButton}
              onClick={beginAdd}
              disabled={actionInFlight}
            >
              Add category
            </button>
          )}

          {categoryLimitReached && !adding && (
            <p className={styles.limitNote}>Maximum of {MAX_USER_CATEGORIES} categories reached.</p>
          )}
        </section>
      )}
    </section>
  )
}
