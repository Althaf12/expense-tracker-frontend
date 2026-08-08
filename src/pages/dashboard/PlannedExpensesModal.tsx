import { useState, useCallback, type ReactElement, type FormEvent, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { X, Pencil, Trash2, Plus, Check, XCircle } from 'lucide-react'
import type { UserExpense, UserExpenseCategory } from '../../types/app'
import styles from './PlannedExpensesModal.module.css'

type TemplateGroup = {
  categoryId: string
  categoryName: string
  expenses: UserExpense[]
}

type AddDraft = {
  name: string
  categoryId: string
  amount: string
}

type EditDraft = {
  name: string
  amount: string
}

type Props = {
  open: boolean
  onClose: () => void
  groupedUserExpenses: TemplateGroup[]
  expenseCategories: UserExpenseCategory[]
  formatCurrency: (n: number) => string
  onAdd: (payload: { userExpenseName: string; userExpenseCategoryId: string | number; amount: number }) => Promise<void>
  onEdit: (payload: { id: string | number; userExpenseName: string; amount: number }) => Promise<void>
  onDelete: (id: string | number) => Promise<void>
}

const parseAmount = (value: string): number | null => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export default function PlannedExpensesModal({
  open,
  onClose,
  groupedUserExpenses,
  expenseCategories,
  formatCurrency,
  onAdd,
  onEdit,
  onDelete,
}: Props): ReactElement | null {
  const modalRef = useRef<HTMLDivElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft>({ name: '', amount: '' })
  const [showAddForm, setShowAddForm] = useState(false)
  const [addDraft, setAddDraft] = useState<AddDraft>({ name: '', categoryId: '', amount: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const activeCategories = expenseCategories.filter((c) => c.status === 'A')

  const closeModal = useCallback(() => {
    setEditingId(null)
    setEditDraft({ name: '', amount: '' })
    setShowAddForm(false)
    setAddDraft({ name: '', categoryId: '', amount: '' })
    setError('')
    onClose()
  }, [onClose])

  const startEdit = useCallback((expense: UserExpense) => {
    setEditingId(String(expense.userExpensesId))
    setEditDraft({
      name: expense.userExpenseName,
      amount: String(expense.amount ?? ''),
    })
    setError('')
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditDraft({ name: '', amount: '' })
    setError('')
  }, [])

  const handleSaveEdit = useCallback(async (expense: UserExpense) => {
    const trimmedName = editDraft.name.trim()
    if (!trimmedName) {
      setError('Expense name is required.')
      return
    }
    const amount = parseAmount(editDraft.amount)
    if (amount === null) {
      setError('A valid amount (0 or more) is required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onEdit({ id: expense.userExpensesId, userExpenseName: trimmedName, amount })
      setEditingId(null)
      setEditDraft({ name: '', amount: '' })
    } catch {
      setError('Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [editDraft, onEdit])

  const handleDelete = useCallback(async (expense: UserExpense) => {
    const confirmed = window.confirm(`Delete the planned expense "${expense.userExpenseName}"?`)
    if (!confirmed) return
    setSaving(true)
    setError('')
    try {
      await onDelete(expense.userExpensesId)
    } catch {
      setError('Failed to delete expense. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [onDelete])

  const handleAdd = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    const trimmedName = addDraft.name.trim()
    if (!trimmedName) {
      setError('Expense name is required.')
      return
    }
    if (!addDraft.categoryId) {
      setError('Category is required.')
      return
    }
    const amount = parseAmount(addDraft.amount)
    if (amount === null) {
      setError('A valid amount (0 or more) is required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onAdd({ userExpenseName: trimmedName, userExpenseCategoryId: addDraft.categoryId, amount })
      setAddDraft({ name: '', categoryId: '', amount: '' })
      setShowAddForm(false)
    } catch {
      setError('Failed to add expense. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [addDraft, onAdd])

  // Prevent background scrolling while modal is open, but allow modal body to scroll
  useEffect(() => {
    if (!open) return
    const handleWheel = (e: WheelEvent) => {
      // Check if the event target is inside the modal
      if (!modalRef.current || !modalRef.current.contains(e.target as Node)) {
        // Outside modal - prevent background scroll
        e.preventDefault()
        return
      }

      // Inside modal - always prevent default to stop background scroll
      e.preventDefault()

      // Find the scrollable body container and scroll it if possible
      const body = modalRef.current.querySelector('div[class*="body"]') as HTMLElement | null
      if (body && body.scrollHeight > body.clientHeight) {
        body.scrollTop += e.deltaY
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      // Check if the event target is inside the modal
      if (!modalRef.current || !modalRef.current.contains(e.target as Node)) {
        // Outside modal - prevent background scroll
        e.preventDefault()
      }
      // Inside modal - let touch scroll work naturally on body
    }

    document.addEventListener('wheel', handleWheel, { passive: false })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    return () => {
      document.removeEventListener('wheel', handleWheel)
      document.removeEventListener('touchmove', handleTouchMove)
    }
  }, [open])

  // Close on Escape key for accessibility
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, saving])

  if (!open) return null

  const allExpenses = groupedUserExpenses.flatMap((g) => g.expenses)

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !saving) {
      closeModal()
    }
  }

  const modal = (
    <div className={styles.overlay} onClick={handleOverlayClick} role="dialog" aria-modal="true" aria-label="Manage planned expenses">
      <div className={styles.modal} ref={modalRef}>
        <header className={styles.header}>
          <h2 className={styles.title}>
            <span aria-hidden="true">📋</span>
            Manage Planned Expenses
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={closeModal}
            aria-label="Close modal"
            disabled={saving}
          >
            <X size={18} />
          </button>
        </header>

        <div className={styles.body}>
          {error && <p className={styles.errorMessage}>{error}</p>}

          {allExpenses.length === 0 && !showAddForm ? (
            <p className={styles.emptyText}>
              No planned expenses yet. Use the form below to add your first one.
            </p>
          ) : (
            groupedUserExpenses.map((group) => (
              <div key={group.categoryId} className={styles.categoryGroup}>
                <div className={styles.categoryGroupHeader}>
                  <span className={styles.categoryGroupName}>{group.categoryName}</span>
                </div>
                {group.expenses.length === 0 ? (
                  <p className={styles.emptyText}>No expenses in this category.</p>
                ) : (
                  <ul className={styles.expenseList}>
                    {group.expenses.map((expense) => {
                      const id = String(expense.userExpensesId)
                      const isEditing = editingId === id
                      if (isEditing) {
                        return (
                          <li key={id} className={styles.editRow}>
                            <div className={styles.editFields}>
                              <input
                                className={styles.inputField}
                                type="text"
                                value={editDraft.name}
                                onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                                placeholder="Expense name"
                                disabled={saving}
                                aria-label="Expense name"
                                autoFocus
                              />
                              <input
                                className={`${styles.inputField} ${styles.amountInput}`}
                                type="number"
                                min="0"
                                step="any"
                                value={editDraft.amount}
                                onChange={(e) => setEditDraft((d) => ({ ...d, amount: e.target.value }))}
                                placeholder="Amount"
                                disabled={saving}
                                aria-label="Amount"
                              />
                            </div>
                            <div className={styles.editRowActions}>
                              <button
                                type="button"
                                className={styles.cancelEditButton}
                                onClick={cancelEdit}
                                disabled={saving}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className={styles.saveButton}
                                onClick={() => handleSaveEdit(expense)}
                                disabled={saving}
                              >
                                <Check size={14} />
                                Save
                              </button>
                            </div>
                          </li>
                        )
                      }
                      return (
                        <li key={id} className={styles.expenseItem}>
                          <div className={styles.expenseInfo}>
                            <span className={styles.expenseName}>{expense.userExpenseName}</span>
                            <span className={styles.expenseAmount}>{formatCurrency(Number(expense.amount ?? 0))}</span>
                          </div>
                          <div className={styles.expenseActions}>
                            <button
                              type="button"
                              className={styles.iconButton}
                              onClick={() => startEdit(expense)}
                              disabled={saving || editingId !== null}
                              aria-label={`Edit ${expense.userExpenseName}`}
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                              onClick={() => handleDelete(expense)}
                              disabled={saving}
                              aria-label={`Delete ${expense.userExpenseName}`}
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            ))
          )}

          {/* Add new expense section */}
          <div className={styles.addSection}>
            <div className={styles.addSectionHeader}>
              <span>Add New Planned Expense</span>
              <button
                type="button"
                className={styles.toggleAddButton}
                onClick={() => {
                  setShowAddForm((v) => !v)
                  setError('')
                }}
                disabled={saving}
                aria-expanded={showAddForm}
              >
                {showAddForm ? (
                  <><XCircle size={15} /> Hide</>
                ) : (
                  <><Plus size={15} /> Add</>
                )}
              </button>
            </div>
            {showAddForm && (
              <form className={styles.addForm} onSubmit={handleAdd}>
                <select
                  className={styles.selectField}
                  value={addDraft.categoryId}
                  onChange={(e) => setAddDraft((d) => ({ ...d, categoryId: e.target.value }))}
                  disabled={saving}
                  aria-label="Category"
                >
                  <option value="">Select category…</option>
                  {activeCategories.map((cat) => (
                    <option key={String(cat.userExpenseCategoryId)} value={String(cat.userExpenseCategoryId)}>
                      {cat.userExpenseCategoryName}
                    </option>
                  ))}
                </select>
                <div className={styles.addFormRow}>
                  <input
                    className={styles.inputField}
                    type="text"
                    value={addDraft.name}
                    onChange={(e) => setAddDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="Expense name"
                    disabled={saving}
                    aria-label="Expense name"
                  />
                  <input
                    className={`${styles.inputField} ${styles.amountInput}`}
                    type="number"
                    min="0"
                    step="any"
                    value={addDraft.amount}
                    onChange={(e) => setAddDraft((d) => ({ ...d, amount: e.target.value }))}
                    placeholder="Amount"
                    disabled={saving}
                    aria-label="Amount"
                  />
                </div>
                <button type="submit" className={styles.addButton} disabled={saving}>
                  <Plus size={15} />
                  Add Expense
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return ReactDOM.createPortal(modal, document.body)
}
