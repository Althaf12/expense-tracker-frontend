/**
 * Auth module barrel export
 */

export { default as authService, login, checkAuth, refreshAuth, redirectToLogin, logout, toSessionData } from './authService'
export type { AuthUser, LoginResult } from './authService'
export { AUTH_BASE_URL, MAIN_SITE_URL, API_BASE_URL, getLoginUrl, getLogoutUrl, getAuthMeUrl, getRefreshUrl } from './config'
export { authFetch } from './httpClient'
