import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { X, Download, Mail, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import type { ExportType, ExportFormat } from '../types/app'
import {
  downloadExpensesReport,
  downloadIncomeReport,
  downloadAllReport,
  emailExpensesReport,
  emailIncomeReport,
  emailAllReport,
} from '../api'
import { useAppDataContext } from '../context/AppDataContext'
import styles from './ExportModal.module.css'

type ExportMode = 'download' | 'email'

type ExportModalProps = {
  open: boolean
  onClose: () => void
  /** Which page triggered the modal: determines default export type */
  defaultExportType?: ExportType
  /** Pre-filled date range (optional) */
  defaultStartDate?: string
  defaultEndDate?: string
}

const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function ExportModal({
  open,
  onClose,
  defaultExportType = 'BOTH',
  defaultStartDate,
  defaultEndDate,
}: ExportModalProps): ReactElement | null {
  const { session, setStatus } = useAppDataContext()

  // Form state
  const [exportMode, setExportMode] = useState<ExportMode>('download')
  const [exportType, setExportType] = useState<ExportType>(defaultExportType)
  const [format, setFormat] = useState<ExportFormat>('EXCEL')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')

  // Set defaults when modal opens
  useEffect(() => {
    if (open) {
      setExportType(defaultExportType)
      setError('')
      setSuccess('')
      
      // Set default dates: start of current month to today
      const today = new Date()
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      
      setStartDate(defaultStartDate || formatDateForInput(firstOfMonth))
      setEndDate(defaultEndDate || formatDateForInput(today))
      
      // Pre-fill email from session if available
      if (session?.email) {
        setEmail(session.email)
      }
    }
  }, [open, defaultExportType, defaultStartDate, defaultEndDate, session?.email])

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, loading, onClose])

  if (!open) return null

  const validateForm = (): boolean => {
    setError('')
    
    if (!startDate) {
      setError('Start date is required')
      return false
    }
    if (!endDate) {
      setError('End date is required')
      return false
    }
    
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    if (start > end) {
      setError('Start date cannot be after end date')
      return false
    }
    
    // Check for max 1 year (366 days)
    const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays > 366) {
      setError('Date range cannot exceed 1 year (366 days)')
      return false
    }
    
    if (exportMode === 'email') {
      if (!email.trim()) {
        setError('Email address is required')
        return false
      }
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email.trim())) {
        setError('Invalid email address format')
        return false
      }
    }
    
    return true
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    if (!session?.userId) {
      setError('Please sign in to export data')
      return
    }
    
    if (!validateForm()) return
    
    setLoading(true)
    setError('')
    setSuccess('')
    
    try {
      const payload = {
        userId: session.userId,
        startDate,
        endDate,
        format,
        email: email.trim(),
      }
      
      if (exportMode === 'download') {
        // Download the file
        if (exportType === 'EXPENSES') {
          await downloadExpensesReport(payload)
        } else if (exportType === 'INCOME') {
          await downloadIncomeReport(payload)
        } else {
          await downloadAllReport(payload)
        }
        setSuccess('Report downloaded successfully!')
        setStatus({ type: 'success', message: 'Report downloaded successfully!' })
        // Close modal after short delay on success
        setTimeout(() => onClose(), 1500)
      } else {
        // Email the report
        let response
        if (exportType === 'EXPENSES') {
          response = await emailExpensesReport(payload)
        } else if (exportType === 'INCOME') {
          response = await emailIncomeReport(payload)
        } else {
          response = await emailAllReport(payload)
        }
        
        if (response.success) {
          setSuccess(response.message)
          setStatus({ type: 'success', message: response.message })
          setTimeout(() => onClose(), 2000)
        } else {
          setError(response.message || 'Failed to send email')
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed'
      setError(message)
      setStatus({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !loading) {
      onClose()
    }
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="export-modal-title">
        <header className={styles.header}>
          <h2 id="export-modal-title" className={styles.title}>
            <Download size={20} />
            Export Data
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Export Mode Toggle */}
          <div className={styles.modeToggle}>
            <button
              type="button"
              className={`${styles.modeButton} ${exportMode === 'download' ? styles.modeButtonActive : ''}`}
              onClick={() => setExportMode('download')}
              disabled={loading}
            >
              <Download size={16} />
              Download
            </button>
            <button
              type="button"
              className={`${styles.modeButton} ${exportMode === 'email' ? styles.modeButtonActive : ''}`}
              onClick={() => setExportMode('email')}
              disabled={loading}
            >
              <Mail size={16} />
              Email
            </button>
          </div>

          {/* Export Type */}
          <div className={styles.field}>
            <label className={styles.label}>Export Type</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="exportType"
                  value="EXPENSES"
                  checked={exportType === 'EXPENSES'}
                  onChange={() => setExportType('EXPENSES')}
                  disabled={loading}
                />
                <span>Expenses Only</span>
              </label>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="exportType"
                  value="INCOME"
                  checked={exportType === 'INCOME'}
                  onChange={() => setExportType('INCOME')}
                  disabled={loading}
                />
                <span>Income Only</span>
              </label>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="exportType"
                  value="BOTH"
                  checked={exportType === 'BOTH'}
                  onChange={() => setExportType('BOTH')}
                  disabled={loading}
                />
                <span>Both</span>
              </label>
            </div>
          </div>

          {/* Format Selection */}
          <div className={styles.field}>
            <label className={styles.label}>Format</label>
            <div className={styles.formatToggle}>
              <button
                type="button"
                className={`${styles.formatButton} ${format === 'EXCEL' ? styles.formatButtonActive : ''}`}
                onClick={() => setFormat('EXCEL')}
                disabled={loading}
              >
                <FileSpreadsheet size={16} />
                Excel
              </button>
              <button
                type="button"
                className={`${styles.formatButton} ${format === 'PDF' ? styles.formatButtonActive : ''}`}
                onClick={() => setFormat('PDF')}
                disabled={loading}
              >
                <FileText size={16} />
                PDF
              </button>
            </div>
          </div>

          {/* Date Range */}
          <div className={styles.dateRow}>
            <div className={styles.field}>
              <label htmlFor="export-start-date" className={styles.label}>
                Start Date
              </label>
              <input
                id="export-start-date"
                type="date"
                className={styles.input}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="export-end-date" className={styles.label}>
                End Date
              </label>
              <input
                id="export-end-date"
                type="date"
                className={styles.input}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          {/* Email field (only shown when email mode is selected) */}
          {exportMode === 'email' && (
            <div className={styles.field}>
              <label htmlFor="export-email" className={styles.label}>
                Email Address
              </label>
              <input
                id="export-email"
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter recipient email"
                disabled={loading}
                required
              />
            </div>
          )}

          {/* Error/Success Messages */}
          {error && <div className={styles.errorMessage}>{error}</div>}
          {success && <div className={styles.successMessage}>{success}</div>}

          {/* Actions */}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} className={styles.spinner} />
                  Processing...
                </>
              ) : exportMode === 'download' ? (
                <>
                  <Download size={16} />
                  Download
                </>
              ) : (
                <>
                  <Mail size={16} />
                  Send Email
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
