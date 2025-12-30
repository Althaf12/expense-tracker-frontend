/**
 * SSO Authentication Configuration
 * 
 * Centralized auth is handled by auth.eternivity.com (or localhost:8080 for local dev).
 * This subdomain app does NOT store tokens; it relies on HttpOnly cookies set by the auth domain.
 */

// Auth service base URL - use localhost:8080 for local development
export const AUTH_BASE_URL: string =
  ((import.meta as any)?.env?.VITE_AUTH_BASE_URL as string) || 'http://localhost:8080'

// Main site URL for redirects after logout
export const MAIN_SITE_URL: string =
  ((import.meta as any)?.env?.VITE_MAIN_SITE_URL as string) || 'https://eternivity.com'

// App base URL - where this app is hosted (for logout redirects)
export const APP_BASE_URL: string =
  ((import.meta as any)?.env?.VITE_APP_BASE_URL as string) || 'http://localhost:5176'

// API base URL for this subdomain's backend
export const API_BASE_URL: string =
  ((import.meta as any)?.env?.VITE_API_BASE as string) || 'http://localhost:8081/api'

/**
 * Build login URL with redirect back to current page
 */
export function getLoginUrl(redirectUri?: string): string {
  const redirect = redirectUri || window.location.href
  return `${AUTH_BASE_URL}/login?redirect_uri=${encodeURIComponent(redirect)}`
}

/**
 * Build logout URL
 */
export function getLogoutUrl(): string {
  return `${AUTH_BASE_URL}/api/auth/logout`
}

/**
 * Get the auth check endpoint (/api/auth/me)
 */
export function getAuthMeUrl(): string {
  return `${AUTH_BASE_URL}/api/auth/me`
}

/**
 * Get the token refresh endpoint
 */
export function getRefreshUrl(): string {
  return `${AUTH_BASE_URL}/api/auth/refresh`
}

export default {
  AUTH_BASE_URL,
  MAIN_SITE_URL,
  APP_BASE_URL,
  API_BASE_URL,
  getLoginUrl,
  getLogoutUrl,
  getAuthMeUrl,
  getRefreshUrl,
}
