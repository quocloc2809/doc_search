import { clearAuthSession, getCurrentUser, isAuthenticated, setAuthSession } from './storage'

export function saveLoginSession(loginResponseData) {
  const { accessToken, userId, username, fullName, email, role, groupId } = loginResponseData

  setAuthSession({
    accessToken,
    user: {
      userId,
      username,
      fullName,
      email,
      role,
      groupId: groupId ?? null,
    },
  })
}

export function logout() {
  clearAuthSession()
}

export function getAuthUser() {
  return getCurrentUser()
}

export function hasValidSession() {
  return isAuthenticated()
}
