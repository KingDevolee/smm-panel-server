require('dotenv').config();
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashPassword,
  comparePasswords,
  createTokenResponse
} = require('../services/authService');
const {
  blacklistToken,
  isTokenBlacklisted,
  revokeUserTokens,
  storeActiveSession,
  destroySession,
  getActiveSession
} = require('../services/tokenBlacklistService');
const { authenticateJWT } = require('../middleware/authMiddleware');

/**
 * POST /api/auth/register
 * Register a new user account
 * 
 * Request body:
 * {
 *   "username": "john_doe",
 *   "email": "john@example.com",
 *   "password": "secure_password_123"
 * }
 * 
 * Response (201 Created):
 * {
 *   "status": "success",
 *   "message": "User registered successfully",
 *   "data": {
 *     "user": { id, username, email, created_at },
 *     "tokens": { accessToken, refreshToken, tokenType, expiresIn }
 *   }
 * }
 */
router.post('/register', async (req, res) => {
  let connection = null;

  try {
    const { username, email, password, fullName } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Username, email, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 6 characters long'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid email format'
      });
    }

    console.log(`[AUTH] Registering new user: ${email}`);

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      console.warn(`[AUTH] Registration failed: Email ${email} already exists`);
      return res.status(409).json({
        status: 'error',
        message: 'Email already registered'
      });
    }

    // Check if username already exists
    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      console.warn(`[AUTH] Registration failed: Username ${username} already exists`);
      return res.status(409).json({
        status: 'error',
        message: 'Username already taken'
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const newUser = await User.create({
      username,
      email,
      password_hash: passwordHash,
      full_name: fullName || username,
      balance: 0,
      role: 'user'
    });

    console.log(`[AUTH] ✓ User registered successfully: ${newUser.id}`);

    // Generate tokens
    const tokens = createTokenResponse(newUser);

    // Store active session
    await storeActiveSession(newUser.id, tokens.accessToken, 86400);

    return res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          fullName: newUser.full_name,
          created_at: newUser.created_at
        },
        tokens: tokens
      }
    });

  } catch (error) {
    console.error(`[AUTH] Registration error: ${error.message}`);
    return res.status(500).json({
      status: 'error',
      message: 'Registration failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/auth/login
 * Login user and return JWT tokens
 * 
 * Request body:
 * {
 *   "email": "john@example.com",
 *   "password": "secure_password_123"
 * }
 * 
 * Response (200 OK):
 * {
 *   "status": "success",
 *   "message": "Login successful",
 *   "data": {
 *     "user": { id, username, email, balance },
 *     "tokens": { accessToken, refreshToken, tokenType, expiresIn }
 *   }
 * }
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required'
      });
    }

    console.log(`[AUTH] Login attempt for: ${email}`);

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      console.warn(`[AUTH] Login failed: User ${email} not found`);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Compare passwords
    const isPasswordValid = await comparePasswords(password, user.password_hash);
    if (!isPasswordValid) {
      console.warn(`[AUTH] Login failed: Invalid password for ${email}`);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    console.log(`[AUTH] ✓ Login successful for user ${user.id}`);

    // Generate tokens
    const tokens = createTokenResponse(user);

    // Store active session
    await storeActiveSession(user.id, tokens.accessToken, 86400);

    return res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          balance: user.balance,
          role: user.role || 'user'
        },
        tokens: tokens
      }
    });

  } catch (error) {
    console.error(`[AUTH] Login error: ${error.message}`);
    return res.status(500).json({
      status: 'error',
      message: 'Login failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 * 
 * Request body:
 * {
 *   "refreshToken": "refresh_token_value"
 * }
 * 
 * Response (200 OK):
 * {
 *   "status": "success",
 *   "data": {
 *     "accessToken": "new_access_token",
 *     "tokenType": "Bearer",
 *     "expiresIn": "24h"
 *   }
 * }
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        status: 'error',
        message: 'Refresh token is required'
      });
    }

    console.log('[AUTH] Refreshing access token');

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(refreshToken);
    if (isBlacklisted) {
      console.warn(`[AUTH] Refresh token is blacklisted`);
      return res.status(401).json({
        status: 'error',
        message: 'Refresh token has been revoked'
      });
    }

    // Get user
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(user);

    console.log(`[AUTH] ✓ Access token refreshed for user ${user.id}`);

    return res.status(200).json({
      status: 'success',
      message: 'Access token refreshed',
      data: {
        accessToken: newAccessToken,
        tokenType: 'Bearer',
        expiresIn: process.env.JWT_EXPIRY || '24h'
      }
    });

  } catch (error) {
    console.error(`[AUTH] Token refresh error: ${error.message}`);

    if (error.message.includes('expired')) {
      return res.status(401).json({
        status: 'error',
        message: 'Refresh token has expired',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }

    return res.status(401).json({
      status: 'error',
      message: 'Invalid refresh token'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user and blacklist tokens
 * 
 * Headers:
 * {
 *   "Authorization": "Bearer <access_token>"
 * }
 * 
 * Request body (optional):
 * {
 *   "refreshToken": "refresh_token_value"
 * }
 * 
 * Response (200 OK):
 * {
 *   "status": "success",
 *   "message": "Logged out successfully"
 * }
 */
router.post('/logout', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const accessToken = req.token;
    const { refreshToken } = req.body;

    console.log(`[AUTH] Logout request for user ${userId}`);

    // Blacklist access token
    await blacklistToken(accessToken, 86400); // 24 hours

    // Blacklist refresh token if provided
    if (refreshToken) {
      await blacklistToken(refreshToken, 604800); // 7 days
    }

    // Destroy session
    await destroySession(userId);

    console.log(`[AUTH] ✓ User ${userId} logged out successfully`);

    return res.status(200).json({
      status: 'success',
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error(`[AUTH] Logout error: ${error.message}`);
    return res.status(500).json({
      status: 'error',
      message: 'Logout failed'
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password
 * 
 * Headers:
 * {
 *   "Authorization": "Bearer <access_token>"
 * }
 * 
 * Request body:
 * {
 *   "currentPassword": "old_password",
 *   "newPassword": "new_secure_password"
 * }
 * 
 * Response (200 OK):
 * {
 *   "status": "success",
 *   "message": "Password changed successfully"
 * }
 */
router.post('/change-password', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'New password must be at least 6 characters long'
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'New password must be different from current password'
      });
    }

    console.log(`[AUTH] Password change request for user ${userId}`);

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordValid = await comparePasswords(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      console.warn(`[AUTH] Password change failed: Invalid current password for user ${userId}`);
      return res.status(401).json({
        status: 'error',
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await User.updatePassword(userId, newPasswordHash);

    // Revoke all tokens for this user (force re-login)
    await revokeUserTokens(userId);

    console.log(`[AUTH] ✓ Password changed for user ${userId}, tokens revoked`);

    return res.status(200).json({
      status: 'success',
      message: 'Password changed successfully. Please login again.',
      details: 'All sessions have been invalidated for security. Please login with your new password.'
    });

  } catch (error) {
    console.error(`[AUTH] Password change error: ${error.message}`);
    return res.status(500).json({
      status: 'error',
      message: 'Password change failed'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 * 
 * Headers:
 * {
 *   "Authorization": "Bearer <access_token>"
 * }
 * 
 * Response (200 OK):
 * {
 *   "status": "success",
 *   "data": {
 *     "id": 1,
 *     "username": "john_doe",
 *     "email": "john@example.com",
 *     "balance": 1000.00,
 *     "role": "user",
 *     "created_at": "2026-08-26T10:30:00Z"
 *   }
 * }
 */
router.get('/me', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[AUTH] Fetching profile for user ${userId}`);

    // Get full user data
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        balance: user.balance,
        role: user.role || 'user',
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });

  } catch (error) {
    console.error(`[AUTH] Profile fetch error: ${error.message}`);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch profile'
    });
  }
});

module.exports = router;
