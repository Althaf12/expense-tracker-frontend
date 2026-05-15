/**
 * SSO Authentication Service
 * 
 * Handles authentication via centralized auth.eternivity.com SSO.
 * Does NOT store tokens locally - relies on HttpOnly cookies.
 */

import { getLoginUrl, getLogoutUrl, getAuthMeUrl, getRefreshUrl, AUTH_BASE_URL, API_BASE_URL, APP_BASE_URL } from './config'
import type { SessionData } from '../types/app'

export type AuthUser = {
  userId: string
  username?: string
  email?: string
  profileImageUrl?: string
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
export type RefreshStatus = 'success' | 'token_rotated' | 'error'
let refreshPromise: Promise<RefreshStatus> | null = null

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
      // backend now expects `identifier` (username or email)
      body: JSON.stringify({ identifier: username, password }),
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
 * Login with Google OAuth credential
 * Sends the Google ID token to the backend for verification
 */
export async function loginWithGoogle(credential: string): Promise<LoginResult> {
  try {
    const response = await fetch(`${AUTH_BASE_URL}/api/auth/google`, {
      method: 'POST',
      credentials: 'include', // Required for cookies
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ credential }),
    })

    if (!response.ok) {
      let errorMessage = 'Google login failed'
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorData.error || `Google login failed (${response.status})`
      } catch {
        errorMessage = response.status === 401 
          ? 'Google authentication failed' 
          : `Google login failed (${response.status})`
      }
      return { success: false, error: errorMessage }
    }

    // Login succeeded - cookies are now set
    // Fetch user info to get full user data
    const user = await checkAuth()
    
    if (user) {
      return { success: true, user }
    } else {
      return { success: false, error: 'Google login succeeded but failed to get user info' }
    }
  } catch (error) {
    console.error('Google login error:', error)
    const message = error instanceof Error ? error.message : 'Network error during Google login'
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
          profileImageUrl: data.profileImageUrl || data.profile_image || data.avatar || data.picture,
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
 * Attempt to refresh the authentication token.
 * Returns:
 *   'success'       — refresh succeeded, new tokens are set in cookies
 *   'token_rotated' — refresh endpoint returned 401, meaning the refresh token was
 *                     already consumed (likely by another tab). The caller should
 *                     retry the original request once; the other tab's refresh may
 *                     have already set fresh cookies.
 *   'error'         — network or server error, redirect to login
 */
export async function refreshAuth(): Promise<RefreshStatus> {
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

      if (response.status === 401) {
        // Refresh token was already rotated (likely consumed by another tab)
        return 'token_rotated'
      }
      return response.ok ? 'success' : 'error'
    } catch (error) {
      console.error('Token refresh error:', error)
      return 'error'
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
    // Notify application backend of user's last activity (best-effort)
    try {
      await fetch(`${API_BASE_URL}/user/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })
    } catch (apiErr) {
      console.error('API logout (last activity) error:', apiErr)
    }

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
    profileImageUrl: user.profileImageUrl,
    token: undefined, // No token storage - using HttpOnly cookies
    subscription: user.subscription,
  }
}

export default {
  login,
  loginWithGoogle,
  checkAuth,
  refreshAuth,
  redirectToLogin,
  logout,
  toSessionData,
}
