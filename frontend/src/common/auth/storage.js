import { AUTH_STORAGE_KEYS } from './constants'

export function setAuthSession({ accessToken, user }) {
  if (accessToken) {
    localStorage.setItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, accessToken)
  }

  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(user))
  }
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN)
  localStorage.removeItem(AUTH_STORAGE_KEYS.USER)
}

export function getAccessToken() {
  return localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN)
}

export function getCurrentUser() {
  const rawUser = localStorage.getItem(AUTH_STORAGE_KEYS.USER)
  if (!rawUser) {
    return null
  }

  try {
    return JSON.parse(rawUser)
  } catch {
    return null
  }
}

export function isAuthenticated() {
  return Boolean(getAccessToken())
}
