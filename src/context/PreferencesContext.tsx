import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactElement,
} from 'react'
import type { FontSize, CurrencyCode, IncomeMonth, ShowHideInfo, UserPreferences } from '../types/app'
import { CURRENCY_SYMBOLS } from '../types/app'
import { fetchUserPreferences, updateUserPreferences } from '../api'
import { useTheme, type Theme } from './ThemeContext'
import { guestStore } from '../utils/guestStore'

const PREFERENCES_STORAGE_KEY = 'user-preferences'
const GUEST_PREFERENCES_KEY = 'guest-preferences'

type PreferencesContextValue = {
  fontSize: FontSize
  currencyCode: CurrencyCode
  currencySymbol: string
  incomeMonth: IncomeMonth
  showHideInfo: ShowHideInfo
  loading: boolean
  setFontSize: (size: FontSize) => Promise<void>
  setCurrencyCode: (code: CurrencyCode) => Promise<void>
  setIncomeMonth: (pref: IncomeMonth) => Promise<void>
  setShowHideInfo: (pref: ShowHideInfo) => Promise<void>
  loadPreferences: (username: string) => Promise<void>
  formatCurrency: (amount: number) => string
  maskAmount: (formattedAmount: string) => string
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined)

const getStoredPreferences = (isGuest: boolean): Partial<UserPreferences> | null => {
  if (typeof window === 'undefined') return null
  try {
    // Use sessionStorage for guest, localStorage for real users
    const storage = isGuest ? window.sessionStorage : window.localStorage
    const key = isGuest ? GUEST_PREFERENCES_KEY : PREFERENCES_STORAGE_KEY
    const stored = storage.getItem(key)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    /* ignore */
  }
  return null
}

const storePreferences = (prefs: Partial<UserPreferences>, isGuest: boolean) => {
  if (typeof window === 'undefined') return
  try {
    const storage = isGuest ? window.sessionStorage : window.localStorage
    const key = isGuest ? GUEST_PREFERENCES_KEY : PREFERENCES_STORAGE_KEY
    const existing = getStoredPreferences(isGuest) || {}
    storage.setItem(key, JSON.stringify({ ...existing, ...prefs }))
  } catch {
    /* ignore */
  }
}

const applyFontSize = (size: FontSize) => {
  if (typeof document === 'undefined') return
  // Base font sizes: S = 70.31% (was Large), M = 76.5%, L = 82.5%
  const fontSizeMap: Record<FontSize, string> = {
    S: '70.3125%',
    M: '76.5%',
    L: '82.5%',
  }
  document.documentElement.style.fontSize = fontSizeMap[size]
  document.documentElement.setAttribute('data-font-size', size)
}

export function PreferencesProvider({
  children,
  userId,
}: PropsWithChildren<{ userId?: string | null }>): ReactElement {
  const { setTheme: setThemeContext } = useTheme()
  const isGuest = guestStore.isGuestUser(userId)

  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    const stored = getStoredPreferences(isGuest)
    const initial = (stored?.fontSize as FontSize) || 'S'
    applyFontSize(initial)
    return initial
  })

  const [currencyCode, setCurrencyCodeState] = useState<CurrencyCode>(() => {
    const stored = getStoredPreferences(isGuest)
    return (stored?.currencyCode as CurrencyCode) || 'INR'
  })

  const [incomeMonth, setIncomeMonthState] = useState<IncomeMonth>(() => {
    const stored = getStoredPreferences(isGuest)
    return (stored?.incomeMonth as IncomeMonth) || 'P'
  })

  const [showHideInfo, setShowHideInfoState] = useState<ShowHideInfo>(() => {
    const stored = getStoredPreferences(isGuest)
    return (stored?.showHideInfo as ShowHideInfo) || 'S'
  })

  const [loading, setLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(userId || null)

  // Load preferences from API when userId changes
  const loadPreferences = useCallback(async (user: string) => {
    if (!user) return
    const userIsGuest = guestStore.isGuestUser(user)
    setLoading(true)
    try {
      const prefs = await fetchUserPreferences(user)
      if (prefs) {
        setFontSizeState(prefs.fontSize || 'S')
        setCurrencyCodeState(prefs.currencyCode || 'INR')
        setIncomeMonthState(prefs.incomeMonth || 'P')
        setShowHideInfoState(prefs.showHideInfo || 'S')
        applyFontSize(prefs.fontSize || 'S')
        // Sync theme with ThemeContext
        if (prefs.theme) {
          const themeValue: Theme = prefs.theme === 'L' ? 'light' : 'dark'
          setThemeContext(themeValue)
        }
        storePreferences({
          fontSize: prefs.fontSize,
          currencyCode: prefs.currencyCode,
          theme: prefs.theme,
          incomeMonth: prefs.incomeMonth,
          showHideInfo: prefs.showHideInfo,
          userId: user,
        }, userIsGuest)
      }
      setCurrentUserId(user)
    } catch {
      /* use defaults if API fails */
    } finally {
      setLoading(false)
    }
  }, [setThemeContext])

  useEffect(() => {
    if (userId && userId !== currentUserId) {
      loadPreferences(userId)
    }
  }, [userId, currentUserId, loadPreferences])

  const setFontSize = useCallback(
    async (size: FontSize) => {
      const userIsGuest = guestStore.isGuestUser(currentUserId)
      setFontSizeState(size)
      applyFontSize(size)
      storePreferences({ fontSize: size }, userIsGuest)
      if (currentUserId) {
        try {
          await updateUserPreferences({ userId: currentUserId, fontSize: size })
        } catch {
          /* ignore API errors - local state is updated */
        }
      }
    },
    [currentUserId]
  )

  const setCurrencyCode = useCallback(
    async (code: CurrencyCode) => {
      const userIsGuest = guestStore.isGuestUser(currentUserId)
      setCurrencyCodeState(code)
      storePreferences({ currencyCode: code }, userIsGuest)
      if (currentUserId) {
        try {
          await updateUserPreferences({ userId: currentUserId, currencyCode: code })
        } catch {
          /* ignore API errors */
        }
      }
    },
    [currentUserId]
  )

  const setIncomeMonth = useCallback(
    async (pref: IncomeMonth) => {
      const userIsGuest = guestStore.isGuestUser(currentUserId)
      setIncomeMonthState(pref)
      storePreferences({ incomeMonth: pref }, userIsGuest)
      if (currentUserId) {
        try {
          await updateUserPreferences({ userId: currentUserId, incomeMonth: pref })
        } catch {
          /* ignore API errors */
        }
      }
    },
    [currentUserId]
  )

  const setShowHideInfo = useCallback(
    async (pref: ShowHideInfo) => {
      const userIsGuest = guestStore.isGuestUser(currentUserId)
      setShowHideInfoState(pref)
      storePreferences({ showHideInfo: pref }, userIsGuest)
      if (currentUserId) {
        try {
          await updateUserPreferences({ userId: currentUserId, showHideInfo: pref })
        } catch {
          /* ignore API errors */
        }
      }
    },
    [currentUserId]
  )

  const currencySymbol = useMemo(() => CURRENCY_SYMBOLS[currencyCode], [currencyCode])

  const numberFormatter = useMemo(() => {
    const locale = currencyCode === 'INR' ? 'en-IN' : 'en-US'
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }, [currencyCode])

  const formatCurrency = useCallback(
    (amount: number): string => {
      if (!Number.isFinite(amount)) {
        return '-'
      }
      const symbol = CURRENCY_SYMBOLS[currencyCode] ?? currencyCode
      let formatted: string
      try {
        formatted = `${symbol}${numberFormatter.format(amount)}`
      } catch {
        formatted = `${symbol}${amount.toFixed(2)}`
      }
      // Auto-mask when showHideInfo is 'H'
      if (showHideInfo === 'H') {
        return formatted.replace(/\d/g, 'X')
      }
      return formatted
    },
    [currencyCode, numberFormatter, showHideInfo]
  )

  // Mask digits in a formatted amount string with 'X' when showHideInfo is 'H'
  const maskAmount = useCallback(
    (formattedAmount: string): string => {
      if (showHideInfo === 'S') {
        return formattedAmount
      }
      // Replace all digits with 'X'
      return formattedAmount.replace(/\d/g, 'X')
    },
    [showHideInfo]
  )

  const value = useMemo(
    () => ({
      fontSize,
      currencyCode,
      currencySymbol,
      incomeMonth,
      showHideInfo,
      loading,
      setFontSize,
      setCurrencyCode,
      setIncomeMonth,
      setShowHideInfo,
      loadPreferences,
      formatCurrency,
      maskAmount,
    }),
    [fontSize, currencyCode, currencySymbol, incomeMonth, showHideInfo, loading, setFontSize, setCurrencyCode, setIncomeMonth, setShowHideInfo, loadPreferences, formatCurrency, maskAmount]
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export const usePreferences = (): PreferencesContextValue => {
  const context = useContext(PreferencesContext)
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider')
  }
  return context
}

export default PreferencesContext