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
import { CssBaseline } from '@mui/material'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { createAppTheme } from '../theme'

export type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'preferred-theme'

type ThemeContextValue = {
  theme: Theme
  setTheme: (next: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const isTheme = (value: unknown): value is Theme => value === 'dark' || value === 'light'

const getPreferredTheme = (): Theme => {
  if (typeof window === 'undefined') {
    return 'dark'
  }
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (isTheme(stored)) {
      return stored
    }
  } catch {
    /* ignore storage issues */
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    try {
      if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light'
      }
    } catch {
      /* ignore media query issues */
    }
  }
  return 'dark'
}

export function ThemeProvider({ children }: PropsWithChildren): ReactElement {
  const [theme, setThemeState] = useState<Theme>(() => {
    const preferred = getPreferredTheme()
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', preferred)
      document.documentElement.classList.toggle('theme-dark', preferred === 'dark')
      document.documentElement.classList.toggle('theme-light', preferred === 'light')
    }
    return preferred
  })

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.classList.toggle('theme-dark', theme === 'dark')
    document.documentElement.classList.toggle('theme-light', theme === 'light')
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      /* ignore storage write issues */
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [setTheme, theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  )

  const muiTheme = useMemo(() => createAppTheme(theme), [theme])

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline enableColorScheme />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  )
}

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
