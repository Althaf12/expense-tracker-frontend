/**
 * HTTP Client with 401 interceptor for SSO
 * 
 * Wraps fetch with automatic 401 handling:
 * - On 401, attempts token refresh once
 * - If refresh succeeds, retries the original request
 * - If refresh fails, redirects to login
 */

import { refreshAuth, redirectToLogin, type RefreshStatus } from './authService'
import { API_BASE_URL } from './config'

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  skipAuth?: boolean // For requests that don't need auth (e.g., public endpoints)
}

// Track ongoing requests to prevent duplicate refresh attempts
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: Response) => void
  reject: (error: Error) => void
  url: string
  options: RequestInit
}> = []

function processQueue(shouldRetry: boolean): void {
  failedQueue.forEach(async ({ resolve, reject, url, options }) => {
    if (shouldRetry) {
      try {
        const response = await fetch(url, options)
        resolve(response)
      } catch (error) {
        reject(error as Error)
      }
    } else {
      reject(new Error('Authentication failed'))
    }
  })
  failedQueue = []
}

/**
 * Make an authenticated request to the API
 * Automatically handles 401 responses with token refresh
 */
export async function authFetch(
  path: string,
  options: RequestOptions = {}
): Promise<unknown> {
  const { method, body, headers = {}, skipAuth = false } = options
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`
  
  const isBodyPresent = body !== undefined && body !== null
  const requestMethod = method ?? (isBodyPresent ? 'POST' : 'GET')
  
  const fetchOptions: RequestInit = {
    method: requestMethod,
    headers: {
      'Accept': 'application/json',
      ...(isBodyPresent ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    credentials: 'include', // Always include cookies for cross-origin
  }

  if (isBodyPresent) {
    fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body)
  }

  try {
    let response = await fetch(url, fetchOptions)

    // Handle 401 - attempt refresh and retry
    if (response.status === 401 && !skipAuth) {
      if (!isRefreshing) {
        isRefreshing = true
        
        const refreshStatus: RefreshStatus = await refreshAuth()
        isRefreshing = false
        
        if (refreshStatus === 'success') {
          // Refresh succeeded — retry the original request
          response = await fetch(url, fetchOptions)
          processQueue(true)
        } else if (refreshStatus === 'token_rotated') {
          // Refresh token was already rotated by another tab.
          // The other tab's refresh may have already set fresh cookies,
          // so retry the original request once before giving up.
          const retryResponse = await fetch(url, fetchOptions)
          if (retryResponse.status === 401) {
            // Still failing after retry — session is truly expired
            processQueue(false)
            redirectToLogin()
            throw new Error('Session expired')
          }
          response = retryResponse
          processQueue(true)
        } else {
          // Refresh failed (network/server error) — redirect to login
          processQueue(false)
          redirectToLogin()
          throw new Error('Session expired')
        }
      } else {
        // Another refresh is in progress - queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: async (retryResponse: Response) => {
              const text = await retryResponse.text()
              if (!retryResponse.ok) {
                reject(new Error(`Request failed: ${retryResponse.status}`))
                return
              }
              if (!text) {
                resolve(null)
                return
              }
              try {
                resolve(JSON.parse(text))
              } catch {
                resolve(text)
              }
            },
            reject,
            url,
            options: fetchOptions,
          })
        })
      }
    }

    // Handle other error responses
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Request to ${url} failed: ${response.status} ${text || response.statusText}`)
    }

    // Parse response
    const text = await response.text().catch(() => '')
    if (!text) return null
    
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`API request error for ${url}: ${message}`)
  }
}

export default authFetch
