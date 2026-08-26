const redis = require('redis');

/**
 * Redis Token Blacklist Service
 * Maintains a blacklist of logged-out/revoked tokens
 * Prevents reuse of invalidated tokens
 */

// Create Redis client
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || null,
  db: process.env.REDIS_DB || 0
});

// Error handling
redisClient.on('error', (err) => {
  console.error('[REDIS] Connection error:', err);
});

redisClient.on('connect', () => {
  console.log('[REDIS] ✓ Connected to Redis');
});

/**
 * Add token to blacklist
 * @param {string} token - JWT token to blacklist
 * @param {number} expirySeconds - Token expiry time in seconds (default: 24 hours)
 * @returns {Promise<boolean>} - Success status
 */
async function blacklistToken(token, expirySeconds = 86400) {
  try {
    if (!token) {
      throw new Error('Token is required for blacklisting');
    }

    // Create a hash of the token for storage (for security)
    const tokenHash = require('crypto')
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const key = `blacklist:${tokenHash}`;
    
    console.log(`[REDIS] Adding token to blacklist (expires in ${expirySeconds}s)`);

    // Set token in Redis with expiry
    await redisClient.setex(key, expirySeconds, 'true');

    console.log(`[REDIS] ✓ Token blacklisted successfully`);
    return true;

  } catch (error) {
    console.error(`[REDIS] Error blacklisting token: ${error.message}`);
    throw error;
  }
}

/**
 * Check if token is blacklisted
 * @param {string} token - JWT token to check
 * @returns {Promise<boolean>} - True if token is blacklisted
 */
async function isTokenBlacklisted(token) {
  try {
    if (!token) {
      return false;
    }

    const tokenHash = require('crypto')
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const key = `blacklist:${tokenHash}`;

    // Check if token exists in blacklist
    const exists = await redisClient.exists(key);

    if (exists) {
      console.log(`[REDIS] Token is blacklisted`);
      return true;
    }

    return false;

  } catch (error) {
    console.error(`[REDIS] Error checking blacklist: ${error.message}`);
    // Fail safely - allow request if Redis is down
    return false;
  }
}

/**
 * Revoke all tokens for a user
 * Used when changing password or security events
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} - Success status
 */
async function revokeUserTokens(userId) {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const key = `revoked_user:${userId}`;
    const revokeTime = Date.now();

    console.log(`[REDIS] Revoking all tokens for user ${userId}`);

    // Set revoke timestamp
    await redisClient.setex(key, 604800, revokeTime.toString()); // 7 days

    console.log(`[REDIS] ✓ All tokens revoked for user ${userId}`);
    return true;

  } catch (error) {
    console.error(`[REDIS] Error revoking user tokens: ${error.message}`);
    throw error;
  }
}

/**
 * Check if all tokens for user were revoked
 * @param {number} userId - User ID
 * @param {number} issuedAtTime - Token issue timestamp (from iat claim)
 * @returns {Promise<boolean>} - True if tokens were revoked after token was issued
 */
async function areUserTokensRevoked(userId, issuedAtTime) {
  try {
    if (!userId || !issuedAtTime) {
      return false;
    }

    const key = `revoked_user:${userId}`;

    // Get revoke timestamp
    const revokeTime = await redisClient.get(key);

    if (!revokeTime) {
      return false;
    }

    // If token was issued before revoke time, it's invalid
    if (issuedAtTime * 1000 < parseInt(revokeTime)) {
      console.log(`[REDIS] User ${userId} tokens were revoked`);
      return true;
    }

    return false;

  } catch (error) {
    console.error(`[REDIS] Error checking user token revocation: ${error.message}`);
    // Fail safely
    return false;
  }
}

/**
 * Store active session
 * Useful for tracking user activity and sessions
 * @param {number} userId - User ID
 * @param {string} token - JWT token
 * @param {number} expirySeconds - Session expiry
 * @returns {Promise<boolean>} - Success status
 */
async function storeActiveSession(userId, token, expirySeconds = 86400) {
  try {
    if (!userId || !token) {
      throw new Error('User ID and token are required');
    }

    const sessionKey = `session:${userId}`;
    const tokenHash = require('crypto')
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const sessionData = JSON.stringify({
      token: tokenHash,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expirySeconds * 1000).toISOString()
    });

    console.log(`[REDIS] Storing active session for user ${userId}`);

    await redisClient.setex(sessionKey, expirySeconds, sessionData);

    console.log(`[REDIS] ✓ Session stored for user ${userId}`);
    return true;

  } catch (error) {
    console.error(`[REDIS] Error storing session: ${error.message}`);
    throw error;
  }
}

/**
 * Get active session for user
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} - Session data or null
 */
async function getActiveSession(userId) {
  try {
    if (!userId) {
      return null;
    }

    const sessionKey = `session:${userId}`;
    const sessionData = await redisClient.get(sessionKey);

    if (!sessionData) {
      return null;
    }

    return JSON.parse(sessionData);

  } catch (error) {
    console.error(`[REDIS] Error getting session: ${error.message}`);
    return null;
  }
}

/**
 * Destroy session (called on logout)
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} - Success status
 */
async function destroySession(userId) {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const sessionKey = `session:${userId}`;

    console.log(`[REDIS] Destroying session for user ${userId}`);

    await redisClient.del(sessionKey);

    console.log(`[REDIS] ✓ Session destroyed for user ${userId}`);
    return true;

  } catch (error) {
    console.error(`[REDIS] Error destroying session: ${error.message}`);
    throw error;
  }
}

/**
 * Clear all expired blacklist entries (cleanup)
 * Redis automatically handles TTL, this is for manual cleanup
 * @returns {Promise<number>} - Number of keys cleaned
 */
async function cleanupExpiredTokens() {
  try {
    console.log('[REDIS] Running cleanup of expired tokens');

    // Redis automatically removes expired keys, this is informational
    // In production, you might want to monitor cleanup
    const scanResult = await redisClient.scan(0, 'MATCH', 'blacklist:*', 'COUNT', 100);
    
    console.log(`[REDIS] ✓ Scanned blacklist entries`);
    return scanResult[1].length;

  } catch (error) {
    console.error(`[REDIS] Error during cleanup: ${error.message}`);
    return 0;
  }
}

/**
 * Connect to Redis
 * @returns {Promise<void>}
 */
async function connectRedis() {
  return new Promise((resolve, reject) => {
    redisClient.on('ready', () => {
      console.log('[REDIS] ✓ Redis client ready');
      resolve();
    });

    redisClient.on('error', (err) => {
      console.error('[REDIS] ✗ Redis connection failed:', err);
      reject(err);
    });

    redisClient.connect();
  });
}

/**
 * Disconnect from Redis
 * @returns {Promise<void>}
 */
async function disconnectRedis() {
  try {
    await redisClient.quit();
    console.log('[REDIS] ✓ Disconnected from Redis');
  } catch (error) {
    console.error('[REDIS] Error disconnecting:', error);
  }
}

module.exports = {
  blacklistToken,
  isTokenBlacklisted,
  revokeUserTokens,
  areUserTokensRevoked,
  storeActiveSession,
  getActiveSession,
  destroySession,
  cleanupExpiredTokens,
  connectRedis,
  disconnectRedis,
  redisClient
};
