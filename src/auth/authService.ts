/**
 * SSO Authentication Service
 * 
 * Handles authentication via centralized auth.eternivity.com SSO.
 * Does NOT store tokens locally - relies on HttpOnly cookies.
 */

import { getLoginUrl, getLogoutUrl, getAuthMeUrl, getRefreshUrl, AUTH_BASE_URL, APP_BASE_URL } from './config'
import type { SessionData } from '../types/app'

export type AuthUser = {
  userId: string
  username?: string
  email?: string
  subscription?: {
    plan?: string
    status?: string
    expiresAt?: string
  }
}

export type LoginResult = {
  success: boolean
  user?: AuthUser
  error?: string
}

// Track if a refresh is in progress to prevent multiple simultaneous refresh calls
let refreshPromise: Promise<boolean> | null = null

/**
 * Login with username and password
 * Calls POST /api/auth/login which sets HttpOnly cookies
 */
export async function login(username: string, password: string): Promise<LoginResult> {
  try {
    const response = await fetch(`${AUTH_BASE_URL}/api/auth/login`, {
      method: 'POST',
      credentials: 'include', // Required for cookies
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    })

    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = 'Login failed'
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorData.error || `Login failed (${response.status})`
      } catch {
        errorMessage = response.status === 401 
          ? 'Invalid username or password' 
          : `Login failed (${response.status})`
      }
      return { success: false, error: errorMessage }
    }

    // Login succeeded - cookies are now set
    // Fetch user info to get full user data
    const user = await checkAuth()
    
    if (user) {
      return { success: true, user }
    } else {
      return { success: false, error: 'Login succeeded but failed to get user info' }
    }
  } catch (error) {
    console.error('Login error:', error)
    const message = error instanceof Error ? error.message : 'Network error during login'
    return { success: false, error: message }
  }
}

/**
 * Check current authentication status by calling /api/auth/me
 * Returns user data if authenticated, null if not
 */
export async function checkAuth(): Promise<AuthUser | null> {
  try {
    const response = await fetch(getAuthMeUrl(), {
      method: 'GET',
      credentials: 'include', // Important: send cookies cross-origin
      headers: {
        'Accept': 'application/json',
      },
    })

    if (response.status === 401) {
      return null
    }

    if (!response.ok) {
      console.warn('Auth check failed with status:', response.status)
      return null
    }

    const data = await response.json()
    
    // Handle various response formats
    if (data && typeof data === 'object') {
      const userId = data.userId || data.user_id || data.id || data.sub
      if (userId) {
        return {
          userId: String(userId),
          username: data.username || data.name || data.displayName,
          email: data.email,
          subscription: data.subscription,
        }
      }
    }

    return null
  } catch (error) {
    console.error('Auth check error:', error)
    return null
  }
}

/**
 * Attempt to refresh the authentication token
 * Returns true if refresh succeeded, false otherwise
 */
export async function refreshAuth(): Promise<boolean> {
  // If a refresh is already in progress, wait for it
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(getRefreshUrl(), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })

      return response.ok
    } catch (error) {
      console.error('Token refresh error:', error)
      return false
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

/**
 * Redirect to login page with current URL as redirect target
 */
export function redirectToLogin(redirectUri?: string): void {
  window.location.href = getLoginUrl(redirectUri)
}

/**
 * Perform global logout via auth service
 */
export async function logout(): Promise<void> {
  try {
    await fetch(getLogoutUrl(), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Logout error:', error)
  }
  
  // Redirect to app home page after logout
  window.location.href = APP_BASE_URL
}

/**
 * Convert AuthUser to SessionData for app compatibility
 */
export function toSessionData(user: AuthUser): SessionData {
  return {
    userId: user.userId,
    username: user.username,
    email: user.email,
    token: undefined, // No token storage - using HttpOnly cookies
    subscription: user.subscription,
  }
}

export default {
  login,
  checkAuth,
  refreshAuth,
  redirectToLogin,
  logout,
  toSessionData,
}
