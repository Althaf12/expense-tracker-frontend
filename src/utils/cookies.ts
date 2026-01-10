/**
 * Cookie utilities for reading auth data from cookies set by the main domain
 */

export type CookieAuthData = {
  userId: string
  token: string
  username?: string
  email?: string
  profileImageUrl?: string
  subscription?: {
    plan?: string
    status?: string
    expiresAt?: string
  }
}

/**
 * Parse a cookie string and return an object of key-value pairs
 */
function parseCookies(): Record<string, string> {
  if (typeof document === 'undefined') return {}
  
  const cookies: Record<string, string> = {}
  const cookieString = document.cookie
  
  if (!cookieString) return cookies
  
  cookieString.split(';').forEach((cookie) => {
    const [rawKey, ...valueParts] = cookie.split('=')
    const key = rawKey?.trim()
    if (key) {
      const value = valueParts.join('=').trim()
      try {
        cookies[key] = decodeURIComponent(value)
      } catch {
        cookies[key] = value
      }
    }
  })
  
  return cookies
}

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const tryParseJSON = (value: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const parseEternityAuthCookie = (raw: string): CookieAuthData | null => {
  const candidates: string[] = []
  const decoded = safeDecode(raw)
  candidates.push(decoded)
  try {
    candidates.push(atob(decoded))
  } catch {
    /* ignore base64 failures */
  }

  for (const candidate of candidates) {
    const parsed = tryParseJSON(candidate)
    if (parsed && typeof parsed === 'object') {
      const token = parsed.token ?? parsed.accessToken ?? parsed.authToken
      const userId = parsed.userId ?? parsed.user_id ?? parsed.userID
      if (token && userId) {
        const username = parsed.username ?? parsed.name
        const email = parsed.email
        const profileImageUrl = (parsed as Record<string, unknown>).profileImageUrl as string
          || (parsed as Record<string, unknown>).profile_image as string
          || (parsed as Record<string, unknown>).avatar as string
          || (parsed as Record<string, unknown>).picture as string
          || undefined
        const subscription = (parsed as Record<string, unknown>).subscription as CookieAuthData['subscription'] | undefined
        return {
          userId: String(userId),
          token: String(token),
          username: username ? String(username) : undefined,
          email: email ? String(email) : undefined,
          profileImageUrl,
          subscription,
        }
      }
    }
  }

  return null
}

/**
 * Get a specific cookie value by name
 */
export function getCookie(name: string): string | null {
  const cookies = parseCookies()
  return cookies[name] ?? null
}

/**
 * Get auth data from cookies
 * Expects cookies: et_token, et_user_id, et_username, et_email, et_subscription
 */
export function getAuthFromCookies(): CookieAuthData | null {
  const cookies = parseCookies()

  // New consolidated auth cookie provided by eternivity
  const eternityRaw = cookies['eternivity_auth']
  if (eternityRaw) {
    const parsed = parseEternityAuthCookie(eternityRaw)
    if (parsed) return parsed
  }
  
  const userId = cookies['et_user_id'] || cookies['userId'] || cookies['user_id']
  const token = cookies['et_token'] || cookies['token']
  
  if (!userId || !token) {
    return null
  }
  
  let subscription: CookieAuthData['subscription'] | undefined
  const subscriptionRaw = cookies['et_subscription'] || cookies['subscription']
  if (subscriptionRaw) {
    try {
      subscription = JSON.parse(subscriptionRaw)
    } catch {
      // If it's not JSON, try to parse as simple value
      subscription = { plan: subscriptionRaw, status: 'active' }
    }
  }
  
  return {
    userId,
    token,
    username: cookies['et_username'] || cookies['username'],
    email: cookies['et_email'] || cookies['email'],
    profileImageUrl: cookies['et_profile_image'] || cookies['profileImageUrl'] || cookies['profile_image'] || cookies['avatar'] || undefined,
    subscription,
  }
}

/**
 * Check if user is authenticated via cookies
 */
export function isAuthenticatedViaCookies(): boolean {
  const auth = getAuthFromCookies()
  return auth !== null && Boolean(auth.userId) && Boolean(auth.token)
}

/**
 * Clear auth cookies (for logout)
 */
export function clearAuthCookies(): void {
  if (typeof document === 'undefined') return
  
  const cookieNames = [
    'et_token', 'et_user_id', 'et_username', 'et_email', 'et_subscription',
    'token', 'userId', 'user_id', 'username', 'email', 'subscription',
    'eternivity_auth'
  ]
  
  // Clear with various domain and path combinations
  const domains = [window.location.hostname, '.eternivity.com', 'eternivity.com']
  const paths = ['/', '']
  
  cookieNames.forEach((name) => {
    // Simple clear
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    
    // Clear with domain variations
    domains.forEach((domain) => {
      paths.forEach((path) => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=${domain}; path=${path || '/'}`
      })
    })
  })
}

export default {
  getCookie,
  getAuthFromCookies,
  isAuthenticatedViaCookies,
  clearAuthCookies,
}
