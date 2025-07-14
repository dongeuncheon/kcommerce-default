import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/config';
import { AppError } from '../../middleware/error';
import { AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { mockAuthService } from '../../services/mockAuth';

class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new AppError('Email and password are required', 400);
      }

      // Find user by email (using mock service)
      const user = await mockAuthService.findUserByEmail(email);

      if (!user || !user.isActive) {
        throw new AppError('Invalid email or password', 401);
      }

      // Verify password
      const isPasswordValid = await mockAuthService.validatePassword(password, user.password);
      if (!isPasswordValid) {
        throw new AppError('Invalid email or password', 401);
      }

      // Check if user is verified
      if (!user.isVerified) {
        throw new AppError('Please verify your email before logging in', 403);
      }

      // Generate JWT token
      const token = mockAuthService.generateToken(user);

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      logger.info('User logged in successfully', { userId: user.id });

      res.json({
        success: true,
        data: {
          user: userWithoutPassword,
          token,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, firstName, lastName } = req.body;

      // Validate input
      if (!email || !password || !firstName || !lastName) {
        throw new AppError('All fields are required', 400);
      }

      // Check if user already exists
      const existingUser = await mockAuthService.findUserByEmail(email);

      if (existingUser) {
        throw new AppError('User with this email already exists', 409);
      }

      // Create user
      const user = await mockAuthService.createUser({
        email: email.toLowerCase(),
        firstName,
        lastName,
        password,
        role: 'USER',
        isActive: true,
        isVerified: true,
      });

      // Generate JWT token
      const token = mockAuthService.generateToken(user);

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      logger.info('User registered successfully', { userId: user.id });

      res.status(201).json({
        success: true,
        data: {
          user: userWithoutPassword,
          token,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // For mock service, just return success
      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      // Find user and generate new token
      const user = await mockAuthService.findUserByEmail(req.user.email);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const token = mockAuthService.generateToken(user);

      res.json({
        success: true,
        data: {
          token,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async verify(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Invalid token', 401);
      }

      res.json({
        success: true,
        data: {
          user: req.user,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const { firstName, lastName } = req.body;

      const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          firstName,
          lastName,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });

      res.json({
        success: true,
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();