/**
 * Authentication Integration Examples
 * Shows how to integrate auth with other commerce modules
 */

import { Container } from '../../../core/di/container';
import { AuthService } from '../auth.service';
import { CustomerService } from '../../customer/customer.service';
import { OrderService } from '../../order/order.service';
import { authMiddleware, requirePermission, requireRole } from '../auth.middleware';
import { Permission, UserRole } from '../auth.types';
import { FastifyInstance } from 'fastify';

/**
 * Example: Customer Registration Flow
 * Register user and create customer profile
 */
export async function registerCustomerFlow() {
  const authService = Container.get(AuthService);
  const customerService = Container.get(CustomerService);

  // 1. Register user
  const authResult = await authService.register({
    email: 'customer@example.com',
    phoneNumber: '010-1234-5678',
    password: 'SecurePassword123!',
    name: 'John Doe',
    koreanName: '홍길동',
    birthDate: '1990-01-01',
    gender: 'M',
    marketingConsent: true,
    termsAccepted: true,
    privacyAccepted: true
  });

  // 2. Create customer profile
  const customer = await customerService.create({
    userId: authResult.user.id,
    email: authResult.user.email,
    phoneNumber: authResult.user.phoneNumber,
    name: authResult.user.name,
    koreanName: authResult.user.koreanName,
    birthDate: authResult.user.birthDate,
    gender: authResult.user.gender,
    marketingConsent: authResult.user.marketingConsent,
    tier: 'BASIC',
    points: 0
  });

  // 3. Link customer to user
  await authService.updateProfile(authResult.user.id, {
    customerId: customer.id
  });

  return { user: authResult.user, customer, tokens: authResult.tokens };
}

/**
 * Example: Protected API Routes
 * Shows how to protect routes with authentication
 */
export function setupProtectedRoutes(server: FastifyInstance) {
  // Customer routes - require authentication
  server.register(async (customerRoutes) => {
    customerRoutes.addHook('preHandler', authMiddleware);

    // View own orders
    customerRoutes.get('/api/orders/my', async (request, reply) => {
      const orderService = Container.get(OrderService);
      const orders = await orderService.getCustomerOrders(request.user.userId);
      return orders;
    });

    // Update profile
    customerRoutes.put('/api/profile', async (request, reply) => {
      const authService = Container.get(AuthService);
      const user = await authService.updateProfile(
        request.user.userId,
        request.body
      );
      return user;
    });
  });

  // Manager routes - require manager role
  server.register(async (managerRoutes) => {
    managerRoutes.addHook('preHandler', [
      authMiddleware,
      requireRole(UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
    ]);

    // View all orders
    managerRoutes.get('/api/manager/orders', async (request, reply) => {
      const orderService = Container.get(OrderService);
      const orders = await orderService.getAllOrders(request.query);
      return orders;
    });

    // Update order status
    managerRoutes.put('/api/manager/orders/:id/status', async (request, reply) => {
      const orderService = Container.get(OrderService);
      const order = await orderService.updateStatus(
        request.params.id,
        request.body.status
      );
      return order;
    });
  });

  // Admin routes - require specific permissions
  server.register(async (adminRoutes) => {
    adminRoutes.addHook('preHandler', authMiddleware);

    // Manage users - require MANAGE_USERS permission
    adminRoutes.get('/api/admin/users', {
      preHandler: requirePermission(Permission.MANAGE_USERS)
    }, async (request, reply) => {
      const authService = Container.get(AuthService);
      const users = await authService['repository'].findAll(request.query);
      return users;
    });

    // View analytics - require VIEW_ANALYTICS permission
    adminRoutes.get('/api/admin/analytics', {
      preHandler: requirePermission(Permission.VIEW_ANALYTICS)
    }, async (request, reply) => {
      const authService = Container.get(AuthService);
      const stats = await authService['repository'].getUserStatsByRole();
      const activeUsers = await authService['repository'].getActiveUsersCount();
      return { stats, activeUsers };
    });
  });
}

/**
 * Example: Social Login with Customer Creation
 */
export async function socialLoginFlow(provider: 'kakao' | 'naver' | 'google', token: string) {
  const authService = Container.get(AuthService);
  const customerService = Container.get(CustomerService);

  // 1. Social login
  const authResult = await authService.socialLogin({
    provider,
    accessToken: token
  });

  // 2. Check if customer profile exists
  let customer = await customerService.findByUserId(authResult.user.id);

  // 3. Create customer profile if not exists
  if (!customer) {
    customer = await customerService.create({
      userId: authResult.user.id,
      email: authResult.user.email,
      phoneNumber: authResult.user.phoneNumber || '',
      name: authResult.user.name,
      tier: 'BASIC',
      points: 0
    });

    // Link customer to user
    await authService.updateProfile(authResult.user.id, {
      customerId: customer.id
    });
  }

  return { user: authResult.user, customer, tokens: authResult.tokens };
}

/**
 * Example: Order Permission Check
 * Check if user can view/modify specific order
 */
export async function checkOrderPermission(
  userId: string,
  orderId: string,
  action: 'view' | 'cancel' | 'update'
): Promise<boolean> {
  const authService = Container.get(AuthService);
  const orderService = Container.get(OrderService);

  // Get order
  const order = await orderService.findById(orderId);
  if (!order) return false;

  // Check if user owns the order
  if (order.customerId === userId) {
    switch (action) {
      case 'view':
        return await authService.hasPermission(userId, Permission.VIEW_OWN_ORDERS);
      case 'cancel':
        return await authService.hasPermission(userId, Permission.CANCEL_OWN_ORDER);
      default:
        return false;
    }
  }

  // Check if user has admin permissions
  switch (action) {
    case 'view':
      return await authService.hasPermission(userId, Permission.VIEW_ALL_ORDERS);
    case 'update':
      return await authService.hasPermission(userId, Permission.UPDATE_ORDER_STATUS);
    default:
      return false;
  }
}

/**
 * Example: VIP Customer Check
 * Middleware to check VIP status for exclusive features
 */
export async function vipCustomerMiddleware(request: any, reply: any) {
  if (!request.user) {
    return reply.code(401).send({ error: 'Authentication required' });
  }

  const authService = Container.get(AuthService);
  const hasVipAccess = await authService.hasAnyPermission(request.user.userId, [
    Permission.ACCESS_VIP_PRODUCTS,
    Permission.ACCESS_VIP_DISCOUNTS
  ]);

  if (!hasVipAccess) {
    return reply.code(403).send({ error: 'VIP membership required' });
  }
}

/**
 * Example: Multi-Factor Authentication Flow
 */
export async function loginWith2FA(email: string, password: string, totpCode?: string) {
  const authService = Container.get(AuthService);

  // 1. Initial login
  try {
    const result = await authService.login({ email, password });
    
    // If 2FA not required, return tokens
    if (result.tokens.accessToken) {
      return result;
    }

    // 2FA required - verify code
    if (!totpCode) {
      return { requiresTwoFactor: true, userId: result.user.id };
    }

    // 2. Verify 2FA code
    const verified = await authService.verifyTwoFactor(result.user.id, totpCode);
    if (!verified) {
      throw new Error('Invalid 2FA code');
    }

    // 3. Complete login
    return await authService.login({ email, password });
  } catch (error) {
    throw error;
  }
}

/**
 * Example: Session Management
 * List and manage user sessions
 */
export async function manageUserSessions(userId: string, currentSessionId: string) {
  const authService = Container.get(AuthService);

  // Get all active sessions
  const sessions = await authService['repository'].getActiveSessions(userId);

  // Revoke old sessions (keep only last 3)
  const sortedSessions = sessions.sort((a, b) => 
    b.lastActivity.getTime() - a.lastActivity.getTime()
  );

  for (let i = 3; i < sortedSessions.length; i++) {
    if (sortedSessions[i].id !== currentSessionId) {
      await authService['repository'].revokeSession(
        sortedSessions[i].id,
        'Too many active sessions'
      );
    }
  }

  return sortedSessions.slice(0, 3);
}

/**
 * Example: Password Policy Enforcement
 * Custom password validation for Korean users
 */
export function validateKoreanPassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Length check
  if (password.length < 8) {
    errors.push('비밀번호는 최소 8자 이상이어야 합니다');
  }

  // Uppercase check
  if (!/[A-Z]/.test(password)) {
    errors.push('대문자를 포함해야 합니다');
  }

  // Lowercase check
  if (!/[a-z]/.test(password)) {
    errors.push('소문자를 포함해야 합니다');
  }

  // Number check
  if (!/\d/.test(password)) {
    errors.push('숫자를 포함해야 합니다');
  }

  // Special character check
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('특수문자를 포함해야 합니다');
  }

  // Common passwords check
  const commonPasswords = ['password', '12345678', 'qwerty123', 'admin123'];
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('너무 일반적인 비밀번호입니다');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}