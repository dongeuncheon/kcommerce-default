// 간단한 메모리 기반 인증 서비스 (개발용)
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { config } from '../config/config'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  password: string
  role: string
  isActive: boolean
  isVerified: boolean
}

// 메모리 DB (개발용)
const users: User[] = [
  {
    id: '1',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    password: bcrypt.hashSync('admin123', 12), // 미리 해시된 비밀번호
    role: 'ADMIN',
    isActive: true,
    isVerified: true
  },
  {
    id: '2',
    email: 'user@example.com',
    firstName: 'Regular',
    lastName: 'User',
    password: bcrypt.hashSync('user123', 12),
    role: 'USER',
    isActive: true,
    isVerified: true
  }
]

export class MockAuthService {
  async findUserByEmail(email: string): Promise<User | null> {
    return users.find(user => user.email.toLowerCase() === email.toLowerCase()) || null
  }

  async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  }

  generateToken(user: User): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      config.jwt.secret,
      {
        expiresIn: config.jwt.expiresIn,
      }
    )
  }

  async verifyToken(token: string): Promise<User | null> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any
      return users.find(user => user.id === decoded.userId) || null
    } catch {
      return null
    }
  }

  async createUser(userData: Omit<User, 'id' | 'password'> & { password: string }): Promise<User> {
    const hashedPassword = await bcrypt.hash(userData.password, 12)
    const newUser: User = {
      id: (users.length + 1).toString(),
      ...userData,
      password: hashedPassword,
    }
    users.push(newUser)
    return newUser
  }
}

export const mockAuthService = new MockAuthService()