import { Typography } from '@mui/material'
import type { ReactElement } from 'react'
import styles from './Dashboard.shared.module.css'
import localStyles from './SpendByCategory.module.css'

type CategoryEntry = { name: string; total: number }

type Props = {
  label: string
  categorySummary: CategoryEntry[]
  filteredCategorySummary: CategoryEntry[]
  categoryTableFilters: { name: string; total: string }
  handleCategoryFilterChange: (field: 'name' | 'total', value: string) => void
  clearCategoryFilters: () => void
  categoryFiltersApplied: boolean
  formatAmount: (value: number) => string
}

export default function SpendByCategory({
  label,
  categorySummary,
  filteredCategorySummary,
  categoryTableFilters,
  handleCategoryFilterChange,
  clearCategoryFilters,
  categoryFiltersApplied,
  formatAmount,
}: Props): ReactElement {
  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}>
        <div>
          <Typography variant="h5" component="h2" className={styles.cardTitle}>
            Spend by Category
          </Typography>
          <Typography variant="body2" component="p" className={styles.cardSubtitle}>
            {label}
          </Typography>
        </div>
        <span className={styles.cardBadge}>{filteredCategorySummary.length} items</span>
      </header>
      {categorySummary.length === 0 ? (
        <Typography variant="body2" component="p" className={styles.placeholder}>
          No category spend recorded.
        </Typography>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col" className={styles.numeric}>Total</th>
              </tr>
              <tr className={styles.tableFilterRow}>
                <th scope="col">
                  <input
                    className={styles.tableFilterInput}
                    type="search"
                    placeholder="Filter category"
                    value={categoryTableFilters.name}
                    onChange={(event) => handleCategoryFilterChange('name', event.target.value)}
                  />
                </th>
                <th scope="col">
                  <div className={styles.filterControls}>
                    <input
                      className={styles.tableFilterInput}
                      type="search"
                      placeholder="Filter total"
                      value={categoryTableFilters.total}
                      onChange={(event) => handleCategoryFilterChange('total', event.target.value)}
                    />
                    {categoryFiltersApplied && (
                      <button type="button" className={styles.clearButton} onClick={clearCategoryFilters}>
                        Clear
                      </button>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCategorySummary.length === 0 ? (
                <tr className={styles.emptyRow}>
                  <td colSpan={2}>No categories match the current filters.</td>
                </tr>
              ) : (
                (() => {
                  const max = Math.max(...filteredCategorySummary.map((e) => e.total), 0) || 1
                  return filteredCategorySummary.map((entry) => {
                    const pct = Math.round((entry.total / max) * 100)
                    return (
                      <tr key={entry.name}>
                        <td>{entry.name}</td>
                        <td className={styles.numeric}>
                          <div className={localStyles.categoryBar} aria-hidden>
                            <div className={localStyles.categoryBarHeader}>
                              <div className={localStyles.categoryBarName}>{entry.name}</div>
                              <div className={localStyles.categoryBarValue}>{formatAmount(entry.total)}</div>
                            </div>
                            <div className={localStyles.categoryBarTrack}>
                              <div className={localStyles.categoryBarFill} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                })()
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
