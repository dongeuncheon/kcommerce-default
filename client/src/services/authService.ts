import { apiClient } from './apiClient'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role?: string
}

interface LoginResponse {
  user: User
  token: string
}

interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName: string
}

interface VerifyTokenResponse {
  user: User
}

class AuthService {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await apiClient.post('/auth/login', {
      email,
      password,
    })
    // apiClient already extracts response.data, so response contains the actual data
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error || 'Login failed')
  }

  async register(data: RegisterData): Promise<ApiResponse<LoginResponse>> {
    try {
      const response = await apiClient.post('/auth/register', data)
      return response.data
    } catch (error) {
      console.error('Register error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      }
    }
  }

  async logout(): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.post('/auth/logout')
      return response.data
    } catch (error) {
      console.error('Logout error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Logout failed',
      }
    }
  }

  async refreshToken(): Promise<ApiResponse<{ token: string }>> {
    try {
      const response = await apiClient.post('/auth/refresh')
      return response.data
    } catch (error) {
      console.error('Refresh token error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed',
      }
    }
  }

  async verifyToken(): Promise<ApiResponse<VerifyTokenResponse>> {
    try {
      const response = await apiClient.get('/auth/verify')
      return response.data
    } catch (error) {
      console.error('Verify token error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token verification failed',
      }
    }
  }

  async updateProfile(data: Partial<User>): Promise<ApiResponse<User>> {
    try {
      const response = await apiClient.put('/auth/profile', data)
      return response.data
    } catch (error) {
      console.error('Update profile error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Profile update failed',
      }
    }
  }

  async forgotPassword(email: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.post('/auth/forgot-password', { email })
      return response.data
    } catch (error) {
      console.error('Forgot password error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Password reset failed',
      }
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.post('/auth/reset-password', {
        token,
        newPassword,
      })
      return response.data
    } catch (error) {
      console.error('Reset password error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Password reset failed',
      }
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword,
      })
      return response.data
    } catch (error) {
      console.error('Change password error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Password change failed',
      }
    }
  }

  async getLinkedAccounts(): Promise<any[]> {
    try {
      const response = await apiClient.get('/auth/accounts')
      return response.data.data || []
    } catch (error) {
      console.error('Get linked accounts error:', error)
      return []
    }
  }

  async unlinkOAuthAccount(provider: string): Promise<void> {
    try {
      await apiClient.delete(`/auth/accounts/${provider}`)
    } catch (error: any) {
      console.error('Unlink account error:', error)
      throw new Error(error.response?.data?.error || '계정 연결 해제에 실패했습니다.')
    }
  }
}

export const authService = new AuthService()