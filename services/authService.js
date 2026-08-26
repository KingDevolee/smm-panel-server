require('dotenv').config();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

/**
 * JWT Configuration and Helper Functions
 * Uses environment variables for security
 */

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your_refresh_token_secret_change_in_production';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

/**
 * Generate JWT Access Token
 * @param {Object} user - User object with id and email
 * @returns {string} - JWT token
 */
function generateAccessToken(user) {
  try {
    if (!user || !user.id) {
      throw new Error('Invalid user object for token generation');
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        type: 'access'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    console.log(`[JWT] Generated access token for user ${user.id}`);
    return token;
  } catch (error) {
    throw new Error(`Failed to generate access token: ${error.message}`);
  }
}

/**
 * Generate JWT Refresh Token
 * @param {Object} user - User object with id
 * @returns {string} - Refresh token
 */
function generateRefreshToken(user) {
  try {
    if (!user || !user.id) {
      throw new Error('Invalid user object for token generation');
    }

    const token = jwt.sign(
      {
        id: user.id,
        type: 'refresh'
      },
      REFRESH_TOKEN_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    console.log(`[JWT] Generated refresh token for user ${user.id}`);
    return token;
  } catch (error) {
    throw new Error(`Failed to generate refresh token: ${error.message}`);
  }
}

/**
 * Verify JWT Access Token
 * @param {string} token - JWT token to verify
 * @returns {Object} - Decoded token payload
 * @throws {Error} - If token is invalid or expired
 */
function verifyAccessToken(token) {
  try {
    if (!token) {
      throw new Error('No token provided');
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Access token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Verify JWT Refresh Token
 * @param {string} token - Refresh token to verify
 * @returns {Object} - Decoded token payload
 * @throws {Error} - If token is invalid or expired
 */
function verifyRefreshToken(token) {
  try {
    if (!token) {
      throw new Error('No refresh token provided');
    }

    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
}

/**
 * Hash password using bcryptjs
 * @param {string} password - Plain text password
 * @param {number} saltRounds - Number of salt rounds (default: 10)
 * @returns {Promise<string>} - Hashed password
 */
async function hashPassword(password, saltRounds = 10) {
  try {
    if (!password) {
      throw new Error('Password is required');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
  } catch (error) {
    throw new Error(`Failed to hash password: ${error.message}`);
  }
}

/**
 * Compare plain text password with hashed password
 * @param {string} password - Plain text password
 * @param {string} passwordHash - Hashed password from database
 * @returns {Promise<boolean>} - True if passwords match
 */
async function comparePasswords(password, passwordHash) {
  try {
    if (!password || !passwordHash) {
      throw new Error('Password and hash are required');
    }

    const isMatch = await bcrypt.compare(password, passwordHash);
    return isMatch;
  } catch (error) {
    throw new Error(`Failed to compare passwords: ${error.message}`);
  }
}

/**
 * Extract token from Authorization header
 * Expects format: "Bearer <token>"
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} - Token or null if invalid
 */
function extractTokenFromHeader(authHeader) {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Create tokens response object
 * @param {Object} user - User object
 * @returns {Object} - Access and refresh tokens
 */
function createTokenResponse(user) {
  try {
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: JWT_EXPIRY
    };
  } catch (error) {
    throw new Error(`Failed to create token response: ${error.message}`);
  }
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashPassword,
  comparePasswords,
  extractTokenFromHeader,
  createTokenResponse,
  JWT_SECRET,
  JWT_EXPIRY,
  REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRY
};
