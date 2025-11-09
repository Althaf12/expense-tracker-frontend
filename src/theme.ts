import { createTheme, responsiveFontSizes } from '@mui/material/styles'
import type { PaletteMode } from '@mui/material'

type ThemeOptions = Parameters<typeof createTheme>[0]

const breakpointValues = {
  xs: 0,
  sm: 640,
  md: 960,
  lg: 1280,
  xl: 1600,
}

const buildPalette = (mode: PaletteMode) => {
  if (mode === 'light') {
    return {
      mode,
      primary: {
        main: '#2563eb',
        light: '#60a5fa',
        dark: '#1d4ed8',
      },
      secondary: {
        main: '#22c55e',
      },
      background: {
        default: '#f5f7fb',
        paper: 'rgba(255, 255, 255, 0.9)',
      },
      text: {
        primary: '#0f172a',
        secondary: 'rgba(71, 85, 105, 0.85)',
      },
    }
  }

  return {
    mode,
    primary: {
      main: '#60a5fa',
      light: '#93c5fd',
      dark: '#2563eb',
    },
    secondary: {
      main: '#34d399',
    },
    background: {
      default: '#05070d',
      paper: 'rgba(15, 23, 42, 0.85)',
    },
    text: {
      primary: '#e2e8f0',
      secondary: 'rgba(148, 163, 184, 0.8)',
    },
  }
}

type TypographyConfig = NonNullable<NonNullable<ThemeOptions>['typography']>

const baseTypography: TypographyConfig = {
  fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  h1: {
    fontWeight: 700,
    fontSize: '2.75rem',
    lineHeight: 1.15,
  },
  h2: {
    fontWeight: 600,
    fontSize: '2rem',
    lineHeight: 1.25,
  },
  h3: {
    fontWeight: 600,
    fontSize: '1.6rem',
    lineHeight: 1.3,
  },
  h4: {
    fontWeight: 600,
    fontSize: '1.4rem',
    lineHeight: 1.3,
  },
  body1: {
    fontSize: '1rem',
    lineHeight: 1.65,
  },
  body2: {
    fontSize: '0.95rem',
    lineHeight: 1.6,
  },
  subtitle1: {
    fontSize: '0.95rem',
    fontWeight: 500,
  },
  subtitle2: {
    fontSize: '0.85rem',
    fontWeight: 500,
    letterSpacing: '0.06em',
  },
  button: {
    fontWeight: 600,
    textTransform: 'none',
  },
}

const buildTheme = (mode: PaletteMode) =>
  responsiveFontSizes(
    createTheme({
      palette: buildPalette(mode),
      breakpoints: { values: breakpointValues },
      spacing: 5,
      typography: baseTypography,
      shape: {
        borderRadius: 8.75,
      },
      components: {
        MuiTypography: {
          defaultProps: {
            color: 'inherit',
          },
        },
        MuiLink: {
          defaultProps: {
            underline: 'hover',
          },
        },
      },
    }),
  )

export const createAppTheme = (mode: PaletteMode): ReturnType<typeof buildTheme> => buildTheme(mode)

export default createAppTheme
