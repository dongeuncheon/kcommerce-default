# Authentication Module

Comprehensive authentication and authorization system for the commerce-core application with Korean market features.

## Features

### Core Authentication
- **Email and Phone Login**: Support for both email and Korean phone number (010-XXXX-XXXX) authentication
- **JWT Token Management**: Access and refresh token system with secure session management
- **Password Security**: Bcrypt hashing with configurable rounds and comprehensive password policies
- **Account Security**: Failed login tracking, account lockout, and IP-based security measures

### Korean Market Features
- **Korean Phone Number Support**: Validation and formatting for Korean mobile numbers
- **Korean Name Validation**: Support for Korean names (한글) with proper validation
- **Social Login Integration**: 
  - Kakao Login
  - Naver Login
  - Google Login
- **SMS Verification**: Phone number verification via SMS (Korean carriers)

### Advanced Security
- **Two-Factor Authentication (2FA)**: TOTP-based 2FA with backup codes
- **Rate Limiting**: Configurable rate limits for all auth endpoints
- **CSRF Protection**: Token-based CSRF protection for state-changing operations
- **Session Management**: Multiple device sessions with individual revocation
- **Trusted Devices**: Remember trusted devices for 2FA bypass
- **API Keys**: Programmatic access with scoped permissions

### Role-Based Access Control (RBAC)
- **Predefined Roles**:
  - Customer (기본 고객): Basic customer permissions
  - VIP Customer (VIP 고객): Enhanced customer privileges
  - Manager (매니저): Product and order management
  - Admin (관리자): Full system administration
  - Super Admin (최고 관리자): System configuration access
- **Granular Permissions**: Fine-grained permission system
- **Permission Overrides**: Direct permission grants/revokes for users

## API Endpoints

### Public Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login (email/phone + password)
- `POST /api/auth/social-login` - Social provider login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/verify-phone` - Send/verify phone verification code
- `POST /api/auth/verify-email` - Send/verify email verification code
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Protected Endpoints
- `POST /api/auth/logout` - Logout current session
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/change-password` - Change password
- `GET /api/auth/sessions` - List active sessions
- `DELETE /api/auth/sessions/:id` - Revoke specific session
- `POST /api/auth/sessions/revoke-all` - Revoke all sessions
- `POST /api/auth/2fa/enable` - Enable 2FA
- `POST /api/auth/2fa/verify` - Verify 2FA code
- `POST /api/auth/2fa/disable` - Disable 2FA
- `GET /api/auth/trusted-devices` - List trusted devices
- `DELETE /api/auth/trusted-devices/:id` - Remove trusted device
- `GET /api/auth/audit-logs` - View authentication audit logs

## Usage

### Registration
```typescript
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    phoneNumber: '010-1234-5678',
    password: 'SecurePassword123!',
    name: 'John Doe',
    koreanName: '홍길동',
    termsAccepted: true,
    privacyAccepted: true
  })
});

const { user, tokens } = await response.json();
```

### Login
```typescript
// Email login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePassword123!'
  })
});

// Phone login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phoneNumber: '010-1234-5678',
    password: 'SecurePassword123!'
  })
});

const { user, tokens } = await response.json();
```

### Social Login
```typescript
// Kakao login example
const response = await fetch('/api/auth/social-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider: 'kakao',
    accessToken: 'kakao-access-token-from-sdk'
  })
});

const { user, tokens } = await response.json();
```

### Using Protected Endpoints
```typescript
// Include access token in Authorization header
const response = await fetch('/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const user = await response.json();
```

### Phone Verification
```typescript
// Send verification code
await fetch('/api/auth/verify-phone', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phoneNumber: '010-1234-5678'
  })
});

// Verify code
await fetch('/api/auth/verify-phone', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phoneNumber: '010-1234-5678',
    code: '123456'
  })
});
```

## Middleware

### Basic Authentication
```typescript
import { authMiddleware } from '@/modules/auth';

// Protect route
server.get('/protected', { preHandler: authMiddleware }, handler);
```

### Permission-based Protection
```typescript
import { requirePermission, Permission } from '@/modules/auth';

// Require specific permission
server.get('/admin/users', 
  { preHandler: [authMiddleware, requirePermission(Permission.MANAGE_USERS)] },
  handler
);
```

### Role-based Protection
```typescript
import { requireRole, UserRole } from '@/modules/auth';

// Require admin role
server.get('/admin/dashboard',
  { preHandler: [authMiddleware, requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN)] },
  handler
);
```

### Rate Limiting
```typescript
import { rateLimit } from '@/modules/auth';

// Apply rate limiting
server.post('/api/auth/login',
  { 
    preHandler: rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5 // 5 attempts
    })
  },
  handler
);
```

## Security Best Practices

1. **Environment Variables**: Always use environment variables for sensitive configuration
   ```
   JWT_SECRET=your-secret-key
   JWT_EXPIRES_IN=15m
   REFRESH_TOKEN_EXPIRES_IN=7d
   BCRYPT_ROUNDS=10
   ```

2. **HTTPS Only**: Always use HTTPS in production to protect tokens in transit

3. **Secure Cookies**: Store refresh tokens in httpOnly, secure, sameSite cookies

4. **Token Rotation**: Implement token rotation on refresh for enhanced security

5. **Input Validation**: All inputs are validated using schemas and sanitized

6. **Audit Logging**: All authentication events are logged for security monitoring

## Database Schema

The module creates the following tables:
- `users` - User accounts
- `social_accounts` - Linked social login accounts
- `user_sessions` - Active user sessions
- `verification_codes` - Email/phone/2FA verification codes
- `password_reset_tokens` - Password reset tokens
- `login_attempts` - Login attempt tracking
- `roles` - User roles
- `permissions` - System permissions
- `user_permissions` - User permission overrides
- `auth_audit_logs` - Authentication event logs
- `trusted_devices` - Trusted devices for 2FA
- `api_keys` - API keys for programmatic access
- `two_factor_backup_codes` - 2FA backup codes
- `security_questions` - Security questions (Korean feature)

## Integration

### With Customer Module
```typescript
// Link user to customer after registration
const customer = await customerService.create({
  userId: user.id,
  email: user.email,
  phoneNumber: user.phoneNumber,
  name: user.name
});

await authService.updateProfile(user.id, {
  customerId: customer.id
});
```

### With Order Module
```typescript
// Check order permissions
const canViewOrder = await authService.hasPermission(
  userId,
  Permission.VIEW_ALL_ORDERS
);
```

### With Admin Panel
```typescript
// Admin authentication check
if (!user.permissions.includes(Permission.MANAGE_SYSTEM)) {
  throw new Error('Admin access required');
}
```

## Error Handling

The module uses typed errors for consistent error handling:

```typescript
try {
  await authService.login(credentials);
} catch (error) {
  if (error instanceof AuthError) {
    switch (error.code) {
      case AuthErrorCode.INVALID_CREDENTIALS:
        // Handle invalid credentials
        break;
      case AuthErrorCode.USER_LOCKED:
        // Handle locked account
        break;
      case AuthErrorCode.RATE_LIMIT_EXCEEDED:
        // Handle rate limiting
        break;
    }
  }
}
```

## Testing

```bash
# Run auth module tests
npm test -- auth

# Run specific test suite
npm test -- auth.service.test.ts
```

## Monitoring

Monitor these metrics for auth system health:
- Failed login attempts per minute
- Successful login rate
- Token refresh rate
- 2FA adoption rate
- Session duration distribution
- Social login usage by provider