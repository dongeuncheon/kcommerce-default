import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authService } from '@/services/authService'
import toast from 'react-hot-toast'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
  checkAuth: () => Promise<void>
}

interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName: string
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await authService.login(email, password)
          if (response.success && response.data) {
            const { user, token } = response.data
            set({
              user,
              token,
              isAuthenticated: true,
              isLoading: false,
            })
            toast.success('Successfully logged in!')
          } else {
            throw new Error(response.error || 'Login failed')
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false,
          })
          toast.error('Failed to login')
        }
      },

      register: async (data: RegisterData) => {
        set({ isLoading: true, error: null })
        try {
          const response = await authService.register(data)
          if (response.success && response.data) {
            const { user, token } = response.data
            set({
              user,
              token,
              isAuthenticated: true,
              isLoading: false,
            })
            toast.success('Successfully registered!')
          } else {
            throw new Error(response.error || 'Registration failed')
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Registration failed',
            isLoading: false,
          })
          toast.error('Failed to register')
        }
      },

      logout: async () => {
        try {
          await authService.logout()
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            error: null,
          })
          toast.success('Successfully logged out')
        }
      },

      refreshToken: async () => {
        try {
          const response = await authService.refreshToken()
          if (response.success && response.data) {
            const { token } = response.data
            set({ token })
          } else {
            throw new Error('Token refresh failed')
          }
        } catch (error) {
          // Token refresh failed, logout user
          get().logout()
        }
      },

      updateProfile: async (data: Partial<User>) => {
        set({ isLoading: true, error: null })
        try {
          const response = await authService.updateProfile(data)
          if (response.success && response.data) {
            set({
              user: response.data,
              isLoading: false,
            })
            toast.success('Profile updated successfully')
          } else {
            throw new Error(response.error || 'Update failed')
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Update failed',
            isLoading: false,
          })
          toast.error('Failed to update profile')
        }
      },

      checkAuth: async () => {
        const token = get().token
        if (!token) {
          set({ isAuthenticated: false })
          return
        }

        try {
          const response = await authService.verifyToken()
          if (response.success && response.data) {
            set({
              user: response.data.user,
              isAuthenticated: true,
            })
          } else {
            throw new Error('Invalid token')
          }
        } catch (error) {
          // Invalid token, logout
          get().logout()
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)