import { useEffect, useRef, useState, type DragEvent, type ReactElement } from 'react'
import { X, Upload, FileText, Loader2, Info } from 'lucide-react'
import type { HdfcImportResponse } from '../types/app'
import { importHdfcStatement } from '../api'
import { useAppDataContext } from '../context/AppDataContext'
import { useNotifications } from '../context/NotificationsContext'
import styles from './ImportStatementModal.module.css'

type ImportStatementModalProps = {
  open: boolean
  onClose: () => void
  /** Called after a successful import so the parent can refresh its data */
  onImported?: () => void
}

export default function ImportStatementModal({
  open,
  onClose,
  onImported,
}: ImportStatementModalProps): ReactElement | null {
  const { session } = useAppDataContext()
  const { addNotification } = useNotifications()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState<string>('')
  const [storePassword, setStorePassword] = useState<boolean>(false)
  const [useStoredPassword, setUseStoredPassword] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [result, setResult] = useState<HdfcImportResponse | null>(null)
  const [dragOver, setDragOver] = useState<boolean>(false)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setFile(null)
      setPassword('')
      setStorePassword(false)
      setUseStoredPassword(false)
      setError('')
      setResult(null)
      setLoading(false)
      setDragOver(false)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, loading, onClose])

  if (!open) return null

  const acceptFile = (chosen: File) => {
    setError('')
    setResult(null)
    if (chosen.type !== 'application/pdf' && !chosen.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.')
      return
    }
    setFile(chosen)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) acceptFile(dropped)
  }

  const handleFileInputChange = () => {
    const chosen = fileInputRef.current?.files?.[0]
    if (chosen) acceptFile(chosen)
  }

  const handleSubmit = async () => {
    if (!session) return
    if (!file) {
      setError('Please select a PDF file to import.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const response = await importHdfcStatement({
        userId: session.userId,
        file,
        password: password.trim() || undefined,
        storePassword,
        useStoredPassword,
      })
      setResult(response)

      // Show summary as success notification
      const summary = `Imported: ${response.expensesAdded} expense${response.expensesAdded !== 1 ? 's' : ''}, ${response.incomesAdded} income${response.incomesAdded !== 1 ? 's' : ''}`
      addNotification({ type: 'success', message: summary })

      // Show each message from the backend as an info notification
      response.messages.forEach((msg) => {
        addNotification({ type: 'info', message: msg })
      })

      onImported?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) onClose()
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Import Bank Statement">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            <Upload size={18} />
            Import Bank Statement
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={handleClose}
            disabled={loading}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {/* HDFC-only notice */}
          <div className={styles.supportedBankNote}>
            <Info size={14} className={styles.supportedBankNoteIcon} />
            <span>Currently, only <strong>HDFC Bank</strong> statements (PDF) are supported.</span>
          </div>

          <p className={styles.description}>
            Upload your HDFC bank statement PDF. Expenses and incomes will be automatically extracted and added to your account.
          </p>

          {/* File drop zone */}
          {!file ? (
            <div
              className={`${styles.fileDropZone} ${dragOver ? styles.dragOver : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
            >
              <Upload size={28} className={styles.fileDropZoneIcon} />
              <span className={styles.fileDropZoneText}>Click or drag &amp; drop to upload</span>
              <span className={styles.fileDropZoneHint}>PDF files only</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className={styles.hiddenInput}
                onChange={handleFileInputChange}
                disabled={loading}
              />
            </div>
          ) : (
            <div className={styles.fileSelected}>
              <FileText size={18} />
              <span className={styles.fileSelectedName} title={file.name}>{file.name}</span>
              <button
                type="button"
                className={styles.fileSelectedRemove}
                onClick={() => { setFile(null); setResult(null); setError('') }}
                disabled={loading}
                aria-label="Remove file"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Password section */}
          <div className={styles.passwordSection}>
            {/* Use stored password checkbox */}
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={useStoredPassword}
                onChange={(e) => {
                  setUseStoredPassword(e.target.checked)
                  if (e.target.checked) {
                    setPassword('')
                    setStorePassword(false)
                  }
                }}
                disabled={loading}
              />
              Use my stored bank statement password
            </label>

            {/* Manual password fields — hidden when using stored password */}
            {!useStoredPassword && (
              <>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="stmt-password">
                    PDF Password
                    <span className={styles.labelOptional}>(optional)</span>
                  </label>
                  <input
                    id="stmt-password"
                    type="password"
                    className={styles.input}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter if the PDF is password-protected"
                    disabled={loading}
                    autoComplete="off"
                  />
                </div>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={storePassword}
                    onChange={(e) => setStorePassword(e.target.checked)}
                    disabled={loading || !password.trim()}
                  />
                  Save this password for future imports
                </label>
              </>
            )}
          </div>

          {/* Error */}
          {error && <div className={styles.errorMessage}>{error}</div>}

          {/* Success result */}
          {result && (
            <div className={styles.successBox}>
              <div className={styles.successStats}>
                <div className={styles.successStat}>
                  <span className={styles.successStatValue}>{result.expensesAdded}</span>
                  <span className={styles.successStatLabel}>Expenses added</span>
                </div>
                <div className={styles.successStat}>
                  <span className={styles.successStatValue}>{result.incomesAdded}</span>
                  <span className={styles.successStatLabel}>Incomes added</span>
                </div>
                {result.skippedCount > 0 && (
                  <div className={styles.successStat}>
                    <span className={styles.successStatValue}>{result.skippedCount}</span>
                    <span className={styles.successStatLabel}>Skipped</span>
                  </div>
                )}
                {result.statementClosingBalance != null && (
                  <div className={styles.successStat}>
                    <span className={styles.successStatValue}>
                      {result.statementClosingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={styles.successStatLabel}>Closing balance</span>
                  </div>
                )}
              </div>
              {result.balanceMatchWarning && (
                <div className={styles.balanceWarning}>{result.balanceMatchWarning}</div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={handleClose}
              disabled={loading}
            >
              {result ? 'Close' : 'Cancel'}
            </button>
            {!result && (
              <button
                type="button"
                className={styles.submitButton}
                onClick={() => void handleSubmit()}
                disabled={loading || !file}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Import
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
