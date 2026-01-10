/**
 * SSO Authentication Configuration
 * 
 * Centralized auth is handled by auth.eternivity.com (or localhost:8080 for local dev).
 * This subdomain app does NOT store tokens; it relies on HttpOnly cookies set by the auth domain.
 * 
 * All values MUST be set in environment files (.env.development, .env.production, etc.)
 */

// Auth service base URL
export const AUTH_BASE_URL: string = (import.meta as any).env.VITE_AUTH_BASE_URL as string

// Main site URL for registration and redirects
export const MAIN_SITE_URL: string = (import.meta as any).env.VITE_MAIN_SITE_URL as string

// App base URL - where this app is hosted (for logout redirects)
export const APP_BASE_URL: string = (import.meta as any).env.VITE_APP_BASE_URL as string

// API base URL for this subdomain's backend
export const API_BASE_URL: string = (import.meta as any).env.VITE_API_BASE as string

// Google OAuth Client ID
export const GOOGLE_CLIENT_ID: string = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID as string

/**
 * Build login URL with redirect back to current page
 * For SSO, we redirect to auth.eternivity.com/login (or localhost:8080/login in dev)
 */
export function getLoginUrl(redirectUri?: string): string {
  const redirect = redirectUri || window.location.href
  return `${AUTH_BASE_URL}/login?redirect_uri=${encodeURIComponent(redirect)}`
}

/**
 * Build registration URL - redirects to main eternivity.com for registration
 */
export function getRegistrationUrl(): string {
  return `${MAIN_SITE_URL}/register`
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
  GOOGLE_CLIENT_ID,
  getLoginUrl,
  getRegistrationUrl,
  getLogoutUrl,
  getAuthMeUrl,
  getRefreshUrl,
}
