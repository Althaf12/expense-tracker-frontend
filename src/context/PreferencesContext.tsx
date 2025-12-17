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
import type { FontSize, CurrencyCode, UserPreferences } from '../types/app'
import { CURRENCY_SYMBOLS } from '../types/app'
import { fetchUserPreferences, updateUserPreferences } from '../api'
import { useTheme, type Theme } from './ThemeContext'

const PREFERENCES_STORAGE_KEY = 'user-preferences'

type PreferencesContextValue = {
  fontSize: FontSize
  currencyCode: CurrencyCode
  currencySymbol: string
  loading: boolean
  setFontSize: (size: FontSize) => Promise<void>
  setCurrencyCode: (code: CurrencyCode) => Promise<void>
  loadPreferences: (username: string) => Promise<void>
  formatCurrency: (amount: number) => string
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined)

const getStoredPreferences = (): Partial<UserPreferences> | null => {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(PREFERENCES_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    /* ignore */
  }
  return null
}

const storePreferences = (prefs: Partial<UserPreferences>) => {
  if (typeof window === 'undefined') return
  try {
    const existing = getStoredPreferences() || {}
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ ...existing, ...prefs }))
  } catch {
    /* ignore */
  }
}

const applyFontSize = (size: FontSize) => {
  if (typeof document === 'undefined') return
  // Base font sizes: S = 58.59% (original small), M = 64.45% (current), L = 70.31% (larger)
  const fontSizeMap: Record<FontSize, string> = {
    S: '58.59375%',
    M: '64.453125%',
    L: '70.3125%',
  }
  document.documentElement.style.fontSize = fontSizeMap[size]
  document.documentElement.setAttribute('data-font-size', size)
}

export function PreferencesProvider({
  children,
  username,
}: PropsWithChildren<{ username?: string | null }>): ReactElement {
  const { setTheme: setThemeContext } = useTheme()

  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    const stored = getStoredPreferences()
    const initial = (stored?.fontSize as FontSize) || 'S'
    applyFontSize(initial)
    return initial
  })

  const [currencyCode, setCurrencyCodeState] = useState<CurrencyCode>(() => {
    const stored = getStoredPreferences()
    return (stored?.currencyCode as CurrencyCode) || 'INR'
  })

  const [loading, setLoading] = useState(false)
  const [currentUsername, setCurrentUsername] = useState<string | null>(username || null)

  // Load preferences from API when username changes
  const loadPreferences = useCallback(async (user: string) => {
    if (!user) return
    setLoading(true)
    try {
      const prefs = await fetchUserPreferences(user)
      if (prefs) {
        setFontSizeState(prefs.fontSize || 'S')
        setCurrencyCodeState(prefs.currencyCode || 'INR')
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
          username: user,
        })
      }
      setCurrentUsername(user)
    } catch {
      /* use defaults if API fails */
    } finally {
      setLoading(false)
    }
  }, [setThemeContext])

  useEffect(() => {
    if (username && username !== currentUsername) {
      loadPreferences(username)
    }
  }, [username, currentUsername, loadPreferences])

  const setFontSize = useCallback(
    async (size: FontSize) => {
      setFontSizeState(size)
      applyFontSize(size)
      storePreferences({ fontSize: size })
      if (currentUsername) {
        try {
          await updateUserPreferences({ username: currentUsername, fontSize: size })
        } catch {
          /* ignore API errors - local state is updated */
        }
      }
    },
    [currentUsername]
  )

  const setCurrencyCode = useCallback(
    async (code: CurrencyCode) => {
      setCurrencyCodeState(code)
      storePreferences({ currencyCode: code })
      if (currentUsername) {
        try {
          await updateUserPreferences({ username: currentUsername, currencyCode: code })
        } catch {
          /* ignore API errors */
        }
      }
    },
    [currentUsername]
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
      try {
        return `${symbol}${numberFormatter.format(amount)}`
      } catch {
        return `${symbol}${amount.toFixed(2)}`
      }
    },
    [currencyCode, numberFormatter]
  )

  const value = useMemo(
    () => ({
      fontSize,
      currencyCode,
      currencySymbol,
      loading,
      setFontSize,
      setCurrencyCode,
      loadPreferences,
      formatCurrency,
    }),
    [fontSize, currencyCode, currencySymbol, loading, setFontSize, setCurrencyCode, loadPreferences, formatCurrency]
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
