import Grid from '@mui/material/Grid'
import { Typography } from '@mui/material'
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import {
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
  BarChart3,
  LineChart,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Receipt,
  Target,
  Filter,
  Loader2,
  Circle,
  ArrowRight,
  ChevronDown,
} from 'lucide-react'
import { fetchAnalyticsSummaryByRange, fetchAnalyticsSummaryByMonth } from '../../api'
import type { AnalyticsSummary } from '../../types/app'
import { useAppDataContext } from '../../context/AppDataContext'
import { usePreferences } from '../../context/PreferencesContext'
import { friendlyErrorMessage } from '../../utils/format'
import styles from './Analytics.module.css'

type ChartType = 'pie' | 'bar' | 'donut' | 'line' | 'point'
type TimeRange = 'thisMonth' | 'lastMonth' | 'last3Months' | 'last6Months' | 'thisYear' | 'custom'

type CategoryData = {
  name: string
  amount: number
  color: string
  percentage: number
}

type MonthlyData = {
  month: string
  monthKey: string
  expenses: number
  income: number
  prevMonthIncome: number
  net: number
}

// Color palette for charts
const CHART_COLORS = [
  '#60a5fa', // blue
  '#34d399', // green
  '#f472b6', // pink
  '#fbbf24', // amber
  '#a78bfa', // purple
  '#fb7185', // rose
  '#2dd4bf', // teal
  '#fb923c', // orange
  '#818cf8', // indigo
  '#4ade80', // lime
  '#f87171', // red
  '#38bdf8', // sky
]

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const formatDateForApi = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getTimeRangeDates = (range: TimeRange): { start: Date; end: Date } => {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let start: Date

  switch (range) {
    case 'thisMonth':
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'lastMonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      end.setDate(0) // Last day of previous month
      break
    case 'last3Months':
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      break
    case 'last6Months':
      start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      break
    case 'thisYear':
      start = new Date(now.getFullYear(), 0, 1)
      break
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  return { start, end }
}

// Get previous month dates for income comparison
const getPreviousMonthDates = (start: Date): { start: Date; end: Date } => {
  const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1)
  const prevEnd = new Date(start.getFullYear(), start.getMonth(), 0) // Last day of prev month
  return { start: prevStart, end: prevEnd }
}

// Simple Pie/Donut Chart Component
function PieChart({
  data,
  type = 'pie',
  size = 200,
}: {
  data: CategoryData[]
  type?: 'pie' | 'donut'
  size?: number
}): ReactElement {
  const total = data.reduce((sum, d) => sum + d.amount, 0)
  if (total === 0) {
    return (
      <div className={styles.emptyChart}>
        <PieChartIcon size={48} />
        <span>No data available</span>
      </div>
    )
  }

  let currentAngle = 0
  const radius = size / 2
  const center = radius
  const innerRadius = type === 'donut' ? radius * 0.6 : 0

  const segments = data.map((item, index) => {
    const angle = (item.amount / total) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle += angle

    const startRad = (startAngle - 90) * (Math.PI / 180)
    const endRad = (endAngle - 90) * (Math.PI / 180)

    const x1 = center + radius * Math.cos(startRad)
    const y1 = center + radius * Math.sin(startRad)
    const x2 = center + radius * Math.cos(endRad)
    const y2 = center + radius * Math.sin(endRad)

    const x1Inner = center + innerRadius * Math.cos(startRad)
    const y1Inner = center + innerRadius * Math.sin(startRad)
    const x2Inner = center + innerRadius * Math.cos(endRad)
    const y2Inner = center + innerRadius * Math.sin(endRad)

    const largeArc = angle > 180 ? 1 : 0

    const pathD =
      type === 'donut'
        ? `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x2Inner} ${y2Inner} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x1Inner} ${y1Inner} Z`
        : `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`

    return (
      <path
        key={index}
        d={pathD}
        fill={item.color}
        className={styles.pieSegment}
      >
        <title>{`${item.name}: ${item.percentage.toFixed(1)}%`}</title>
      </path>
    )
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={styles.pieChart}>
      {segments}
      {type === 'donut' && (
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="middle"
          className={styles.donutCenter}
        >
          <tspan x={center} dy="-0.3em" className={styles.donutTotal}>
            {data.length}
          </tspan>
          <tspan x={center} dy="1.4em" className={styles.donutLabel}>
            categories
          </tspan>
        </text>
      )}
    </svg>
  )
}

// Bar Chart Component
function BarChart({
  data,
  height = 250,
  showValues = true,
}: {
  data: CategoryData[]
  height?: number
  showValues?: boolean
}): ReactElement {
  const maxAmount = Math.max(...data.map((d) => d.amount), 1)

  if (data.length === 0 || maxAmount === 0) {
    return (
      <div className={styles.emptyChart}>
        <BarChart3 size={48} />
        <span>No data available</span>
      </div>
    )
  }

  return (
    <div className={styles.barChart} style={{ height }}>
      <div className={styles.barContainer}>
        {data.slice(0, 8).map((item, index) => {
          const barHeight = (item.amount / maxAmount) * 100
          return (
            <div key={index} className={styles.barWrapper}>
              <div className={styles.barColumn}>
                {showValues && (
                  <span className={styles.barValue}>
                    {item.amount >= 1000 ? `${(item.amount / 1000).toFixed(1)}k` : item.amount.toFixed(0)}
                  </span>
                )}
                <div
                  className={styles.bar}
                  style={{
                    height: `${barHeight}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
              <span className={styles.barLabel} title={item.name}>
                {item.name.length > 8 ? `${item.name.slice(0, 7)}…` : item.name}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Monthly Trend Chart - supports line, bar, and point chart types
function TrendChart({
  data,
  height = 200,
  chartType = 'line',
  showPrevMonthIncome = false,
}: {
  data: MonthlyData[]
  height?: number
  chartType?: 'line' | 'bar' | 'point'
  showPrevMonthIncome?: boolean
}): ReactElement {
  if (data.length === 0) {
    return (
      <div className={styles.emptyChart}>
        <LineChart size={48} />
        <span>No data available</span>
      </div>
    )
  }

  const maxValue = Math.max(...data.flatMap((d) => [d.expenses, d.income, showPrevMonthIncome ? d.prevMonthIncome : 0]), 1)
  const chartWidth = 100
  const chartHeight = 100

  // For line chart
  const expensesPoints = data
    .map((d, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * chartWidth
      const y = chartHeight - (d.expenses / maxValue) * chartHeight
      return `${x},${y}`
    })
    .join(' ')

  const incomePoints = data
    .map((d, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * chartWidth
      const y = chartHeight - (d.income / maxValue) * chartHeight
      return `${x},${y}`
    })
    .join(' ')

  const prevIncomePoints = showPrevMonthIncome ? data
    .map((d, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * chartWidth
      const y = chartHeight - (d.prevMonthIncome / maxValue) * chartHeight
      return `${x},${y}`
    })
    .join(' ') : ''

  // Bar chart rendering
  if (chartType === 'bar') {
    const barWidth = chartWidth / (data.length * (showPrevMonthIncome ? 3.5 : 2.5))
    return (
      <div className={styles.trendChart} style={{ height }}>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 15}`} preserveAspectRatio="none" className={styles.trendSvg}>
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((y) => (
            <line key={y} x1="0" y1={y} x2={chartWidth} y2={y} className={styles.gridLine} />
          ))}
          {data.map((d, i) => {
            const groupX = (i / data.length) * chartWidth + barWidth / 2
            const incomeHeight = (d.income / maxValue) * chartHeight
            const expenseHeight = (d.expenses / maxValue) * chartHeight
            const prevIncomeHeight = (d.prevMonthIncome / maxValue) * chartHeight
            return (
              <g key={i}>
                {/* Previous month income bar (if enabled) */}
                {showPrevMonthIncome && (
                  <rect
                    x={groupX}
                    y={chartHeight - prevIncomeHeight}
                    width={barWidth * 0.8}
                    height={prevIncomeHeight}
                    fill="#94a3b8"
                    opacity={0.6}
                    className={styles.trendBar}
                  >
                    <title>{`${d.month} Prev Income: ${d.prevMonthIncome.toFixed(0)}`}</title>
                  </rect>
                )}
                {/* Current income bar */}
                <rect
                  x={groupX + (showPrevMonthIncome ? barWidth : 0)}
                  y={chartHeight - incomeHeight}
                  width={barWidth * 0.8}
                  height={incomeHeight}
                  fill="#34d399"
                  className={styles.trendBar}
                >
                  <title>{`${d.month} Income: ${d.income.toFixed(0)}`}</title>
                </rect>
                {/* Expense bar */}
                <rect
                  x={groupX + (showPrevMonthIncome ? barWidth * 2 : barWidth)}
                  y={chartHeight - expenseHeight}
                  width={barWidth * 0.8}
                  height={expenseHeight}
                  fill="#f472b6"
                  className={styles.trendBar}
                >
                  <title>{`${d.month} Expenses: ${d.expenses.toFixed(0)}`}</title>
                </rect>
              </g>
            )
          })}
        </svg>
        <div className={styles.trendLabels}>
          {data.map((d, i) => (
            <span key={i}>{d.month}</span>
          ))}
        </div>
      </div>
    )
  }

  // Point chart (scatter plot style)
  if (chartType === 'point') {
    return (
      <div className={styles.trendChart} style={{ height }}>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" className={styles.trendSvg}>
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((y) => (
            <line key={y} x1="0" y1={y} x2={chartWidth} y2={y} className={styles.gridLine} />
          ))}
          {/* Data points only - larger circles */}
          {data.map((d, i) => {
            const x = (i / Math.max(data.length - 1, 1)) * chartWidth
            const yExpense = chartHeight - (d.expenses / maxValue) * chartHeight
            const yIncome = chartHeight - (d.income / maxValue) * chartHeight
            const yPrevIncome = chartHeight - (d.prevMonthIncome / maxValue) * chartHeight
            return (
              <g key={i}>
                {/* Vertical guideline */}
                <line x1={x} y1={0} x2={x} y2={chartHeight} stroke="var(--surface-border)" strokeWidth="0.5" strokeDasharray="2,2" />
                {/* Previous month income point */}
                {showPrevMonthIncome && (
                  <circle cx={x} cy={yPrevIncome} r="5" fill="#94a3b8" className={styles.dataPoint}>
                    <title>{`${d.month} Prev Income: ${d.prevMonthIncome.toFixed(0)}`}</title>
                  </circle>
                )}
                {/* Income point */}
                <circle cx={x} cy={yIncome} r="5" fill="#34d399" className={styles.dataPoint}>
                  <title>{`${d.month} Income: ${d.income.toFixed(0)}`}</title>
                </circle>
                {/* Expense point */}
                <circle cx={x} cy={yExpense} r="5" fill="#f472b6" className={styles.dataPoint}>
                  <title>{`${d.month} Expenses: ${d.expenses.toFixed(0)}`}</title>
                </circle>
              </g>
            )
          })}
        </svg>
        <div className={styles.trendLabels}>
          {data.map((d, i) => (
            <span key={i}>{d.month}</span>
          ))}
        </div>
      </div>
    )
  }

  // Default: Line chart
  return (
    <div className={styles.trendChart} style={{ height }}>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" className={styles.trendSvg}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2={chartWidth}
            y2={y}
            className={styles.gridLine}
          />
        ))}
        {/* Previous month income line (if enabled) */}
        {showPrevMonthIncome && prevIncomePoints && (
          <polyline
            points={prevIncomePoints}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeDasharray="4,2"
            className={styles.trendLine}
          />
        )}
        {/* Income line */}
        <polyline
          points={incomePoints}
          fill="none"
          stroke="#34d399"
          strokeWidth="2"
          className={styles.trendLine}
        />
        {/* Expenses line */}
        <polyline
          points={expensesPoints}
          fill="none"
          stroke="#f472b6"
          strokeWidth="2"
          className={styles.trendLine}
        />
        {/* Data points */}
        {data.map((d, i) => {
          const x = (i / Math.max(data.length - 1, 1)) * chartWidth
          const yExpense = chartHeight - (d.expenses / maxValue) * chartHeight
          const yIncome = chartHeight - (d.income / maxValue) * chartHeight
          const yPrevIncome = chartHeight - (d.prevMonthIncome / maxValue) * chartHeight
          return (
            <g key={i}>
              {showPrevMonthIncome && (
                <circle cx={x} cy={yPrevIncome} r="3" fill="#94a3b8" className={styles.dataPoint}>
                  <title>{`${d.month} Prev Income: ${d.prevMonthIncome.toFixed(0)}`}</title>
                </circle>
              )}
              <circle cx={x} cy={yIncome} r="3" fill="#34d399" className={styles.dataPoint}>
                <title>{`${d.month} Income: ${d.income.toFixed(0)}`}</title>
              </circle>
              <circle cx={x} cy={yExpense} r="3" fill="#f472b6" className={styles.dataPoint}>
                <title>{`${d.month} Expenses: ${d.expenses.toFixed(0)}`}</title>
              </circle>
            </g>
          )
        })}
      </svg>
      <div className={styles.trendLabels}>
        {data.map((d, i) => (
          <span key={i}>{d.month}</span>
        ))}
      </div>
    </div>
  )
}

// Summary Card Component
function SummaryCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  variant = 'default',
}: {
  title: string
  value: string
  change?: number
  changeLabel?: string
  icon: typeof TrendingUp
  variant?: 'default' | 'success' | 'danger' | 'warning'
}): ReactElement {
  const isPositive = change !== undefined && change >= 0
  return (
    <div className={`${styles.summaryCard} ${styles[`summaryCard${variant.charAt(0).toUpperCase() + variant.slice(1)}`]}`}>
      <div className={styles.summaryIcon}>
        <Icon size={24} />
      </div>
      <div className={styles.summaryContent}>
        <span className={styles.summaryTitle}>{title}</span>
        <span className={styles.summaryValue}>{value}</span>
        {change !== undefined && (
          <span className={`${styles.summaryChange} ${isPositive ? styles.positive : styles.negative}`}>
            {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(change).toFixed(1)}% {changeLabel}
          </span>
        )}
      </div>
    </div>
  )
}

// Loading Placeholder Component
function LoadingPlaceholder({ height = 120 }: { height?: number }): ReactElement {
  return (
    <div className={styles.loadingPlaceholder} style={{ height }}>
      <Loader2 size={24} className={styles.spinner} />
    </div>
  )
}

export default function Analytics(): ReactElement {
  const { session, setStatus } = useAppDataContext()
  const { formatCurrency, incomeMonth } = usePreferences()

  const [loading, setLoading] = useState<boolean>(true)
  const [timeRange, setTimeRange] = useState<TimeRange>('thisMonth')
  const [customStart, setCustomStart] = useState<string>('')
  const [customEnd, setCustomEnd] = useState<string>('')
  
  // Time range dropdown state
  const [timeRangeDropdownOpen, setTimeRangeDropdownOpen] = useState(false)
  const timeRangeDropdownRef = useRef<HTMLDivElement>(null)
  
  // Analytics summary data from new API
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [prevMonthSummary, setPrevMonthSummary] = useState<AnalyticsSummary | null>(null)
  // Income summary for when incomeMonth preference is 'P' (previous month)
  const [incomeSummary, setIncomeSummary] = useState<AnalyticsSummary | null>(null)
  
  // Chart type states
  const [expenseChartType, setExpenseChartType] = useState<ChartType>('donut')
  const [incomeChartType, setIncomeChartType] = useState<ChartType>('bar')
  const [trendChartType, setTrendChartType] = useState<'line' | 'bar' | 'point'>('line')
  const [showPrevMonthIncome, setShowPrevMonthIncome] = useState(false)

  // Load data based on time range using new Analytics API
  useEffect(() => {
    if (!session) return

    const loadData = async () => {
      setLoading(true)
      setStatus({ type: 'loading', message: 'Loading analytics data...' })

      try {
        // Calculate date range
        let start: Date, end: Date
        if (timeRange === 'custom' && customStart && customEnd) {
          start = new Date(customStart)
          end = new Date(customEnd)
        } else {
          const dates = getTimeRangeDates(timeRange)
          start = dates.start
          end = dates.end
        }

        const startStr = formatDateForApi(start)
        const endStr = formatDateForApi(end)

        // Get previous month dates for comparison and income (when incomeMonth is 'P')
        const prevMonthDates = getPreviousMonthDates(start)
        const prevStartStr = formatDateForApi(prevMonthDates.start)
        const prevEndStr = formatDateForApi(prevMonthDates.end)

        // Fetch summaries in parallel
        // When incomeMonth is 'P', we fetch income from the previous month relative to the current range
        const [currentSummary, prevSummary, incomeMonthSummary] = await Promise.all([
          fetchAnalyticsSummaryByRange({
            userId: session.userId,
            start: startStr,
            end: endStr,
          }),
          fetchAnalyticsSummaryByRange({
            userId: session.userId,
            start: prevStartStr,
            end: prevEndStr,
          }),
          // For income, if preference is 'P' (previous month), fetch prev month income
          // This handles cases like "thisMonth" where we need last month's income
          incomeMonth === 'P' 
            ? fetchAnalyticsSummaryByRange({
                userId: session.userId,
                start: prevStartStr,
                end: prevEndStr,
              })
            : Promise.resolve(null),
        ])

        setSummary(currentSummary)
        setPrevMonthSummary(prevSummary)
        // Store income summary - use prev month summary if incomeMonth is 'P', otherwise use current
        setIncomeSummary(incomeMonth === 'P' ? incomeMonthSummary : currentSummary)
        setStatus(null)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStatus({ type: 'error', message: friendlyErrorMessage(message, 'loading analytics') })
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [session, timeRange, customStart, customEnd, setStatus, incomeMonth])

  // Click outside to close time range dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (timeRangeDropdownRef.current && !timeRangeDropdownRef.current.contains(target)) {
        setTimeRangeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Process expense data by category from summary
  const expenseCategoryData = useMemo((): CategoryData[] => {
    if (!summary?.expensesByCategory) return []
    
    const entries = Object.entries(summary.expensesByCategory)
    const total = entries.reduce((sum, [, amount]) => sum + amount, 0)
    
    return entries
      .map(([name, amount], index) => ({
        name,
        amount,
        color: CHART_COLORS[index % CHART_COLORS.length],
        percentage: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [summary])

  // Monthly trend data with previous month income comparison
  const monthlyTrendData = useMemo((): MonthlyData[] => {
    if (!summary) return []
    
    const monthKeys = new Set<string>()
    
    // Collect all month keys from both expense and income trends
    if (summary.monthlyExpenseTrend) {
      Object.keys(summary.monthlyExpenseTrend).forEach(k => monthKeys.add(k))
    }
    if (summary.monthlyIncomeTrend) {
      Object.keys(summary.monthlyIncomeTrend).forEach(k => monthKeys.add(k))
    }
    
    return Array.from(monthKeys)
      .sort()
      .map((key) => {
        const [year, monthNum] = key.split('-')
        const monthIndex = parseInt(monthNum, 10) - 1
        
        // Calculate previous month key
        const prevMonthDate = new Date(parseInt(year), monthIndex - 1, 1)
        const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`
        
        const expenses = summary.monthlyExpenseTrend?.[key] ?? 0
        const income = summary.monthlyIncomeTrend?.[key] ?? 0
        // Get previous month income from current summary or prev month summary
        const prevMonthIncome = summary.monthlyIncomeTrend?.[prevMonthKey] ?? prevMonthSummary?.totalIncome ?? 0
        
        return {
          month: `${MONTHS[monthIndex]} ${year.slice(2)}`,
          monthKey: key,
          expenses,
          income,
          prevMonthIncome,
          net: income - expenses,
        }
      })
  }, [summary, prevMonthSummary])

  // Summary metrics from API
  // Use incomeSummary for income metrics (respects incomeMonth preference)
  const totalExpenses = summary?.totalExpenses ?? 0
  const totalIncome = incomeSummary?.totalIncome ?? 0
  const netSavings = totalIncome - totalExpenses
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0
  const totalExpenseCount = summary?.totalExpenseCount ?? 0
  const totalIncomeCount = incomeSummary?.totalIncomeCount ?? 0

  // Previous month comparison - compare against the month before incomeSummary
  const prevMonthIncome = prevMonthSummary?.totalIncome ?? 0
  const incomeChangeFromPrev = prevMonthIncome > 0 
    ? ((totalIncome - prevMonthIncome) / prevMonthIncome) * 100 
    : 0

  // Income source data should also use incomeSummary
  const incomeSourceData = useMemo((): CategoryData[] => {
    if (!incomeSummary?.incomesBySource) return []
    
    const entries = Object.entries(incomeSummary.incomesBySource)
    const total = entries.reduce((sum, [, amount]) => sum + amount, 0)
    
    return entries
      .map(([name, amount], index) => ({
        name,
        amount,
        color: CHART_COLORS[index % CHART_COLORS.length],
        percentage: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [incomeSummary])

  // Top items
  const topExpenseCategory = expenseCategoryData[0]
  const topIncomeSource = incomeSourceData[0]

  // Render chart based on type
  const renderExpenseChart = () => {
    switch (expenseChartType) {
      case 'pie':
        return <PieChart data={expenseCategoryData} type="pie" size={220} />
      case 'donut':
        return <PieChart data={expenseCategoryData} type="donut" size={220} />
      case 'bar':
        return <BarChart data={expenseCategoryData} height={220} />
      case 'line':
      case 'point':
        return <BarChart data={expenseCategoryData} height={220} />
      default:
        return <PieChart data={expenseCategoryData} type="donut" size={220} />
    }
  }

  const renderIncomeChart = () => {
    switch (incomeChartType) {
      case 'pie':
        return <PieChart data={incomeSourceData} type="pie" size={220} />
      case 'donut':
        return <PieChart data={incomeSourceData} type="donut" size={220} />
      case 'bar':
        return <BarChart data={incomeSourceData} height={220} />
      case 'line':
      case 'point':
        return <BarChart data={incomeSourceData} height={220} />
      default:
        return <BarChart data={incomeSourceData} height={220} />
    }
  }

  return (
    <Grid container component="section" className={styles.page} spacing={3}>
      {/* Header */}
      <Grid size={12}>
        <section className={styles.headerCard}>
          <div className={styles.headerContent}>
            <div className={styles.headerWithIcon}>
              <span className={styles.emojiIcon}>📊</span>
              <div>
                <Typography variant="h5" component="h1" className={styles.title}>
                  Financial Analytics
                </Typography>
                <Typography variant="body2" component="p" className={styles.subtitle}>
                  Visualize your spending patterns and income sources
                </Typography>
              </div>
            </div>
            
            {/* Time Range Selector */}
            <div className={styles.timeRangeSelector}>
              <Filter size={16} className={styles.filterIcon} />
              <div ref={timeRangeDropdownRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className={styles.dropdownTrigger}
                  onClick={() => setTimeRangeDropdownOpen((o) => !o)}
                >
                  <span>
                    {timeRange === 'thisMonth' && 'This Month'}
                    {timeRange === 'lastMonth' && 'Last Month'}
                    {timeRange === 'last3Months' && 'Last 3 Months'}
                    {timeRange === 'last6Months' && 'Last 6 Months'}
                    {timeRange === 'thisYear' && 'This Year'}
                    {timeRange === 'custom' && 'Custom Range'}
                  </span>
                  <ChevronDown size={16} />
                </button>
                {timeRangeDropdownOpen && (
                  <ul className={styles.dropdownList}>
                    {([
                      { value: 'thisMonth', label: 'This Month' },
                      { value: 'lastMonth', label: 'Last Month' },
                      { value: 'last3Months', label: 'Last 3 Months' },
                      { value: 'last6Months', label: 'Last 6 Months' },
                      { value: 'thisYear', label: 'This Year' },
                      { value: 'custom', label: 'Custom Range' },
                    ] as const).map((opt) => (
                      <li
                        key={opt.value}
                        className={`${styles.dropdownItem} ${timeRange === opt.value ? styles.dropdownItemActive : ''}`}
                        onClick={() => {
                          setTimeRange(opt.value)
                          setTimeRangeDropdownOpen(false)
                        }}
                      >
                        {opt.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              {timeRange === 'custom' && (
                <div className={styles.customDateRange}>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className={styles.dateInput}
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className={styles.dateInput}
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      </Grid>

      {/* Summary Cards */}
      <Grid size={12}>
        <div className={styles.summaryGrid}>
          {loading ? (
            <>
              <LoadingPlaceholder height={120} />
              <LoadingPlaceholder height={120} />
              <LoadingPlaceholder height={120} />
              <LoadingPlaceholder height={120} />
            </>
          ) : (
            <>
              <SummaryCard
                title="Total Expenses"
                value={formatCurrency(totalExpenses)}
                icon={Receipt}
                variant="danger"
              />
              <SummaryCard
                title="Total Income"
                value={formatCurrency(totalIncome)}
                change={incomeChangeFromPrev}
                changeLabel="vs prev month"
                icon={Wallet}
                variant="success"
              />
              <SummaryCard
                title="Net Savings"
                value={formatCurrency(netSavings)}
                change={savingsRate}
                changeLabel="savings rate"
                icon={netSavings >= 0 ? TrendingUp : TrendingDown}
                variant={netSavings >= 0 ? 'success' : 'danger'}
              />
              <SummaryCard
                title="Transactions"
                value={`${totalExpenseCount + totalIncomeCount}`}
                icon={Target}
                variant="default"
              />
            </>
          )}
        </div>
      </Grid>

      {/* Expenses by Category */}
      <Grid size={{ xs: 12, md: 6 }}>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div className={styles.cardTitleGroup}>
              <Receipt size={20} className={styles.cardIcon} />
              <Typography variant="h6" component="h2" className={styles.cardTitle}>
                Expenses by Category
              </Typography>
            </div>
            <div className={styles.chartTypeToggle}>
              <button
                className={`${styles.chartTypeBtn} ${expenseChartType === 'donut' ? styles.active : ''}`}
                onClick={() => setExpenseChartType('donut')}
                title="Donut Chart"
              >
                <PieChartIcon size={16} />
              </button>
              <button
                className={`${styles.chartTypeBtn} ${expenseChartType === 'pie' ? styles.active : ''}`}
                onClick={() => setExpenseChartType('pie')}
                title="Pie Chart"
              >
                <PieChartIcon size={16} />
              </button>
              <button
                className={`${styles.chartTypeBtn} ${expenseChartType === 'bar' ? styles.active : ''}`}
                onClick={() => setExpenseChartType('bar')}
                title="Bar Chart"
              >
                <BarChart3 size={16} />
              </button>
            </div>
          </header>
          
          {loading ? (
            <LoadingPlaceholder height={280} />
          ) : (
            <div className={styles.chartSection}>
              <div className={styles.chartContainer}>
                {renderExpenseChart()}
              </div>
              <div className={styles.legendContainer}>
                {expenseCategoryData.slice(0, 6).map((item, index) => (
                  <div key={index} className={styles.legendItem}>
                    <span
                      className={styles.legendColor}
                      style={{ backgroundColor: item.color }}
                    />
                    <span className={styles.legendName}>{item.name}</span>
                    <span className={styles.legendValue}>
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                ))}
                {expenseCategoryData.length > 6 && (
                  <div className={styles.legendMore}>
                    +{expenseCategoryData.length - 6} more
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </Grid>

      {/* Income by Source */}
      <Grid size={{ xs: 12, md: 6 }}>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div className={styles.cardTitleGroup}>
              <Wallet size={20} className={styles.cardIcon} />
              <Typography variant="h6" component="h2" className={styles.cardTitle}>
                Income by Source
              </Typography>
            </div>
            <div className={styles.chartTypeToggle}>
              <button
                className={`${styles.chartTypeBtn} ${incomeChartType === 'bar' ? styles.active : ''}`}
                onClick={() => setIncomeChartType('bar')}
                title="Bar Chart"
              >
                <BarChart3 size={16} />
              </button>
              <button
                className={`${styles.chartTypeBtn} ${incomeChartType === 'donut' ? styles.active : ''}`}
                onClick={() => setIncomeChartType('donut')}
                title="Donut Chart"
              >
                <PieChartIcon size={16} />
              </button>
              <button
                className={`${styles.chartTypeBtn} ${incomeChartType === 'pie' ? styles.active : ''}`}
                onClick={() => setIncomeChartType('pie')}
                title="Pie Chart"
              >
                <PieChartIcon size={16} />
              </button>
            </div>
          </header>
          
          {loading ? (
            <LoadingPlaceholder height={280} />
          ) : (
            <div className={styles.chartSection}>
              <div className={styles.chartContainer}>
                {renderIncomeChart()}
              </div>
              <div className={styles.legendContainer}>
                {incomeSourceData.slice(0, 6).map((item, index) => (
                  <div key={index} className={styles.legendItem}>
                    <span
                      className={styles.legendColor}
                      style={{ backgroundColor: item.color }}
                    />
                    <span className={styles.legendName}>{item.name}</span>
                    <span className={styles.legendValue}>
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                ))}
                {incomeSourceData.length > 6 && (
                  <div className={styles.legendMore}>
                    +{incomeSourceData.length - 6} more
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </Grid>

      {/* Monthly Trend */}
      <Grid size={12}>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div className={styles.cardTitleGroup}>
              <LineChart size={20} className={styles.cardIcon} />
              <Typography variant="h6" component="h2" className={styles.cardTitle}>
                Income vs Expenses Trend
              </Typography>
            </div>
            <div className={styles.trendControls}>
              <div className={styles.chartTypeToggle}>
                <button
                  className={`${styles.chartTypeBtn} ${trendChartType === 'line' ? styles.active : ''}`}
                  onClick={() => setTrendChartType('line')}
                  title="Line Chart"
                >
                  <LineChart size={16} />
                </button>
                <button
                  className={`${styles.chartTypeBtn} ${trendChartType === 'bar' ? styles.active : ''}`}
                  onClick={() => setTrendChartType('bar')}
                  title="Bar Chart"
                >
                  <BarChart3 size={16} />
                </button>
                <button
                  className={`${styles.chartTypeBtn} ${trendChartType === 'point' ? styles.active : ''}`}
                  onClick={() => setTrendChartType('point')}
                  title="Point Chart"
                >
                  <Circle size={16} />
                </button>
              </div>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={showPrevMonthIncome}
                  onChange={(e) => setShowPrevMonthIncome(e.target.checked)}
                  className={styles.checkbox}
                />
                <span>Compare with prev month income</span>
              </label>
            </div>
          </header>
          <div className={styles.trendLegend}>
            {showPrevMonthIncome && (
              <span className={styles.trendLegendItem}>
                <span className={styles.trendDot} style={{ backgroundColor: '#94a3b8' }} />
                Prev Month Income
              </span>
            )}
            <span className={styles.trendLegendItem}>
              <span className={styles.trendDot} style={{ backgroundColor: '#34d399' }} />
              Income
            </span>
            <span className={styles.trendLegendItem}>
              <span className={styles.trendDot} style={{ backgroundColor: '#f472b6' }} />
              Expenses
            </span>
          </div>
          
          {loading ? (
            <LoadingPlaceholder height={250} />
          ) : (
            <TrendChart 
              data={monthlyTrendData} 
              height={250} 
              chartType={trendChartType}
              showPrevMonthIncome={showPrevMonthIncome}
            />
          )}
        </section>
      </Grid>

      {/* Statistics Grid */}
      <Grid size={{ xs: 12, md: 6 }}>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div className={styles.cardTitleGroup}>
              <Receipt size={20} className={styles.cardIcon} />
              <Typography variant="h6" component="h2" className={styles.cardTitle}>
                Expense Insights
              </Typography>
            </div>
          </header>
          
          {loading ? (
            <LoadingPlaceholder height={180} />
          ) : (
            <div className={styles.insightsList}>
              <div className={styles.insightItem}>
                <span className={styles.insightLabel}>Total Categories</span>
                <span className={styles.insightValue}>{expenseCategoryData.length}</span>
              </div>
              <div className={styles.insightItem}>
                <span className={styles.insightLabel}>Total Transactions</span>
                <span className={styles.insightValue}>{totalExpenseCount}</span>
              </div>
              <div className={styles.insightItem}>
                <span className={styles.insightLabel}>Avg. per Transaction</span>
                <span className={styles.insightValue}>{formatCurrency(totalExpenseCount > 0 ? totalExpenses / totalExpenseCount : 0)}</span>
              </div>
              {topExpenseCategory && (
                <div className={styles.insightItem}>
                  <span className={styles.insightLabel}>Top Category</span>
                  <span className={styles.insightValue}>
                    {topExpenseCategory.name}
                    <span className={styles.insightPercent}>
                      ({topExpenseCategory.percentage.toFixed(1)}%)
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div className={styles.cardTitleGroup}>
              <Wallet size={20} className={styles.cardIcon} />
              <Typography variant="h6" component="h2" className={styles.cardTitle}>
                Income Insights
              </Typography>
            </div>
          </header>
          
          {loading ? (
            <LoadingPlaceholder height={180} />
          ) : (
            <div className={styles.insightsList}>
              <div className={styles.insightItem}>
                <span className={styles.insightLabel}>Income Sources</span>
                <span className={styles.insightValue}>{incomeSourceData.length}</span>
              </div>
              <div className={styles.insightItem}>
                <span className={styles.insightLabel}>Total Transactions</span>
                <span className={styles.insightValue}>{totalIncomeCount}</span>
              </div>
              <div className={styles.insightItem}>
                <span className={styles.insightLabel}>Avg. per Transaction</span>
                <span className={styles.insightValue}>{formatCurrency(totalIncomeCount > 0 ? totalIncome / totalIncomeCount : 0)}</span>
              </div>
              <div className={styles.insightItem}>
                <span className={styles.insightLabel}>Prev Month Income</span>
                <span className={styles.insightValue}>
                  {formatCurrency(prevMonthIncome)}
                  {incomeChangeFromPrev !== 0 && (
                    <span className={`${styles.insightPercent} ${incomeChangeFromPrev >= 0 ? styles.positive : styles.negative}`}>
                      ({incomeChangeFromPrev >= 0 ? '+' : ''}{incomeChangeFromPrev.toFixed(1)}%)
                    </span>
                  )}
                </span>
              </div>
              {topIncomeSource && (
                <div className={styles.insightItem}>
                  <span className={styles.insightLabel}>Top Source</span>
                  <span className={styles.insightValue}>
                    {topIncomeSource.name}
                    <span className={styles.insightPercent}>
                      ({topIncomeSource.percentage.toFixed(1)}%)
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
      </Grid>

      {/* Category Breakdown Table */}
      <Grid size={12}>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div className={styles.cardTitleGroup}>
              <BarChart3 size={20} className={styles.cardIcon} />
              <Typography variant="h6" component="h2" className={styles.cardTitle}>
                Category Breakdown
              </Typography>
            </div>
          </header>
          
          {loading ? (
            <LoadingPlaceholder height={300} />
          ) : (
            <div className={styles.breakdownTable}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Share</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseCategoryData.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <span className={styles.categoryCell}>
                          <span
                            className={styles.categoryDot}
                            style={{ backgroundColor: item.color }}
                          />
                          {item.name}
                        </span>
                      </td>
                      <td className={styles.amountCell}>{formatCurrency(item.amount)}</td>
                      <td>{item.percentage.toFixed(1)}%</td>
                      <td>
                        <div className={styles.progressBar}>
                          <div
                            className={styles.progressFill}
                            style={{
                              width: `${item.percentage}%`,
                              backgroundColor: item.color,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {expenseCategoryData.length === 0 && (
                <div className={styles.emptyTable}>
                  No expense data available for the selected period
                </div>
              )}
            </div>
          )}
        </section>
      </Grid>
    </Grid>
  )
}
