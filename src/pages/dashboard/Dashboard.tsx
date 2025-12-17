import { Typography } from '@mui/material'
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactElement } from 'react'
import { Link } from 'react-router-dom'
import {
  addExpense,
  fetchExpensesByMonth,
  fetchIncomeByMonth,
  resolveUserExpenseCategoryId,
  updateUserExpense,
} from '../../api'
import { useAppDataContext } from '../../context/AppDataContext'
import type { Expense, Income, UserExpense, UserExpenseCategory } from '../../types/app'
import styles from './Dashboard.shared.module.css'
import useDashboardData from './useDashboardData'
import SummaryGrid from './SummaryGrid'
import PlannedExpenses from './PlannedExpenses'
import SpendByCategory from './SpendByCategory'
import CurrentMonthExpenses from './CurrentMonthExpenses'

const getCurrentMonthContext = () => {
  const current = new Date()
  const month = current.getMonth() + 1
  const year = current.getFullYear()
  const formatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
  return {
    month,
    year,
    label: formatter.format(current),
  }
}

const getPreviousMonth = (month: number, year: number) => {
  if (month === 1) {
    return { month: 12, year: year - 1 }
  }
  return { month: month - 1, year }
}

const amountFromExpense = (expense: Expense): number => {
  const value = expense.amount ?? expense.expenseAmount
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const amountFromIncome = (income: Income): number => {
  const value = income.amount
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const amountFromUserExpense = (expense: UserExpense): number => {
  const value = expense.amount
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const toISODate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

import type { TrendSummary } from './types'

const calculateTrend = (current: number, previous: number, preferHigher: boolean): TrendSummary => {
  const safeCurrent = Number.isFinite(current) ? current : 0
  const safePrevious = Number.isFinite(previous) ? previous : 0

  if (!Number.isFinite(previous) || previous === 0) {
    const delta = safeCurrent - safePrevious
    if (delta === 0) {
      return { deltaDirection: 'flat', tone: 'neutral', percentage: 0 }
    }
    const improvement = preferHigher ? delta > 0 : delta < 0
    return {
      deltaDirection: delta > 0 ? 'up' : 'down',
      tone: improvement ? 'positive' : 'negative',
      percentage: null,
    }
  }

  const difference = safeCurrent - safePrevious
  if (difference === 0) {
    return { deltaDirection: 'flat', tone: 'neutral', percentage: 0 }
  }

  const percentage = Math.abs(difference) / Math.abs(safePrevious) * 100
  const improvement = preferHigher ? difference > 0 : difference < 0

  return {
    deltaDirection: difference > 0 ? 'up' : 'down',
    tone: improvement ? 'positive' : 'negative',
    percentage,
  }
}

const buildCategorySummary = (expenses: Expense[], categories: UserExpenseCategory[]) => {
  // Normalize category ids to strings so lookups work regardless of numeric/string types
  const categoryMap = new Map<string, string>()
  categories.forEach((category) => {
    const id = String(category.userExpenseCategoryId)
    categoryMap.set(id, category.userExpenseCategoryName)
  })

  const totals = new Map<string, { name: string; total: number }>()

  expenses.forEach((expense) => {
    const explicitName = (expense as Expense & { expenseCategoryName?: string }).expenseCategoryName
    const rawKey =
      (expense as Expense & { userExpenseCategoryId?: string | number }).userExpenseCategoryId ??
      expense.expenseCategoryId
    const key = rawKey !== undefined && rawKey !== null ? String(rawKey) : 'uncategorised'
    const name = explicitName ?? categoryMap.get(key) ?? 'Uncategorised'
    const amount = amountFromExpense(expense)
    if (!totals.has(name)) {
      totals.set(name, { name, total: 0 })
    }
    const entry = totals.get(name)
    if (entry) {
      entry.total += amount
    }
  })

  return Array.from(totals.values()).sort((a, b) => b.total - a.total)
}

type TemplateGroup = {
  categoryId: string
  categoryName: string
  expenses: UserExpense[]
}

export default function Dashboard(): ReactElement {
  const {
    session,
    setStatus,
    loading,
    monthlyExpenses,
    previousMonthExpenses,
    currentMonthIncome,
    previousMonthIncome,
    twoMonthsAgoIncome,
    expenseTableFilters,
    categoryTableFilters,
    templateCategoryOrder,
    templateSaving,
    visibleTemplates,
    month,
    year,
    label,
    previousContext,
    twoMonthsAgoContext,
    filteredMonthlyExpenses,
    categoryNameMap,
    categoryNameLookup,
    resolveCategoryForExpense,
    activeCategoryIds,
    groupedUserExpenses,
    expenseTemplatesTotal,
    completedMonthlyTemplates,
    monthlyTemplateProgress,
    unpaidPlannedExpensesTotal,
    monthlyTotal,
    currentMonthExpenseTotal,
    previousMonthExpenseTotal,
    currentMonthIncomeTotal,
    previousMonthIncomeTotal,
    twoMonthsAgoIncomeTotal,
    totalBalance,
    previousBalance,
    balanceTrend,
    incomeTrend,
    expenseTrend,
    totalAfterDueBalance,
    formatCurrency,
    incomeMonthLabel,
    getTrendHint,
    userExpenses,
    categorySummary,
    handleCategoryDragStart,
    handleCategoryDragOver,
    handleCategoryDrop,
    handleCategoryDragEnd,
    handleTemplateMarkPaid,
    handleResetMonthlyStatus,
    handleExpenseFilterChange,
    handleCategoryFilterChange,
    clearExpenseFilters,
    clearCategoryFilters,
    filteredCategorySummary,
    expenseFiltersApplied,
    categoryFiltersApplied,
    // Pagination
    expenseCurrentPage,
    expensePageSize,
    expenseTotalElements,
    expenseTotalPages,
    handleExpensePageChange,
    handleExpensePageSizeChange,
  } = useDashboardData()
 
  const renderTrend = (trend: TrendSummary | null) => {
    if (!trend || trend.percentage === null) {
      return (
        <span className={`${styles.trendIndicator} ${styles.trendIndicatorFlat} ${styles.trendNeutral}`}>
          No previous data
        </span>
      )
    }

    const orientationClass =
      trend.tone === 'positive'
        ? styles.trendIndicatorUp
        : trend.tone === 'negative'
        ? styles.trendIndicatorDown
        : trend.deltaDirection === 'up'
        ? styles.trendIndicatorUp
        : trend.deltaDirection === 'down'
        ? styles.trendIndicatorDown
        : styles.trendIndicatorFlat

    const toneClass =
      trend.tone === 'positive'
        ? styles.trendPositive
        : trend.tone === 'negative'
        ? styles.trendNegative
        : styles.trendNeutral

    const prefix = trend.deltaDirection === 'up' ? '+' : trend.deltaDirection === 'down' ? '-' : ''

    return (
      <span className={`${styles.trendIndicator} ${orientationClass} ${toneClass}`}>
        {`${prefix}${trend.percentage.toFixed(1)}%`}
      </span>
    )
  }


  return (
    <section className={styles.dashboard}>
      <SummaryGrid
        label={label}
        totalBalance={totalBalance}
        totalAfterDueBalance={totalAfterDueBalance}
        unpaidPlannedExpensesTotal={unpaidPlannedExpensesTotal}
        previousMonthIncomeTotal={previousMonthIncomeTotal}
        currentMonthExpenseTotal={currentMonthExpenseTotal}
        incomeMonthLabel={incomeMonthLabel}
        balanceTrend={balanceTrend}
        incomeTrend={incomeTrend}
        expenseTrend={expenseTrend}
        formatCurrency={formatCurrency}
        getTrendHint={getTrendHint}
        renderTrend={renderTrend}
        loading={loading}
      />

      <div className={styles.templatesRow}>
        <div className={styles.templatesColumn}>
          <PlannedExpenses
            groupedUserExpenses={groupedUserExpenses}
            completedMonthlyTemplates={completedMonthlyTemplates}
            visibleTemplates={visibleTemplates}
            monthlyTemplateProgress={monthlyTemplateProgress}
            templateSaving={templateSaving}
            handleResetMonthlyStatus={handleResetMonthlyStatus}
            handleCategoryDragStart={handleCategoryDragStart}
            handleCategoryDragOver={handleCategoryDragOver}
            handleCategoryDrop={handleCategoryDrop}
            handleCategoryDragEnd={handleCategoryDragEnd}
            handleTemplateMarkPaid={handleTemplateMarkPaid}
            expenseTemplatesTotal={expenseTemplatesTotal}
            formatCurrency={formatCurrency}
            userExpenses={userExpenses}
            loading={loading}
          />
          <SpendByCategory
            label={label}
            categorySummary={categorySummary}
            filteredCategorySummary={filteredCategorySummary}
            categoryTableFilters={categoryTableFilters}
            handleCategoryFilterChange={handleCategoryFilterChange}
            clearCategoryFilters={clearCategoryFilters}
            categoryFiltersApplied={categoryFiltersApplied}
            formatCurrency={formatCurrency}
            loading={loading}
          />
        </div>

        <CurrentMonthExpenses
          label={label}
          monthlyExpenses={monthlyExpenses}
          filteredMonthlyExpenses={filteredMonthlyExpenses}
          loading={loading}
          expenseTableFilters={expenseTableFilters}
          handleExpenseFilterChange={handleExpenseFilterChange}
          clearExpenseFilters={clearExpenseFilters}
          expenseFiltersApplied={expenseFiltersApplied}
          formatCurrency={formatCurrency}
          monthlyTotal={monthlyTotal}
          currentPage={expenseCurrentPage}
          totalPages={expenseTotalPages}
          totalElements={expenseTotalElements}
          pageSize={expensePageSize}
          onPageChange={handleExpensePageChange}
          onPageSizeChange={handleExpensePageSizeChange}
        />
      </div>
    </section>
  )
}
