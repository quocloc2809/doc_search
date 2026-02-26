import axios from 'axios'
import { AUTH_STORAGE_KEYS } from '../auth/constants'
import { getAccessToken } from '../auth/storage'

const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:3001',
  timeout: Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000),
  headers: {
    'Content-Type': 'application/json',
  },
})

httpClient.interceptors.request.use(
  (config) => {
    const accessToken = getAccessToken()

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }

    return config
  },
  (error) => Promise.reject(error),
)

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN)
      localStorage.removeItem(AUTH_STORAGE_KEYS.USER)
    }

    return Promise.reject(error)
  },
)

export default httpClient
