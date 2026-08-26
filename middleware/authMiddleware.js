const { verifyAccessToken, extractTokenFromHeader } = require('../services/authService');

/**
 * Middleware to verify JWT token from Authorization header
 * Extracts user information and attaches to request object
 * 
 * Usage:
 * router.post('/protected-route', authenticateJWT, (req, res) => {
 *   console.log(req.user); // User info from token
 * });
 */
async function authenticateJWT(req, res, next) {
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        status: 'error',
        message: 'Authorization header is required',
        details: 'Please provide Authorization: Bearer <token>'
      });
    }

    // Extract token from header
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid authorization format',
        details: 'Please use format: Authorization: Bearer <token>'
      });
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Attach user to request
    req.user = decoded;
    req.token = token;

    console.log(`[AUTH] ✓ User ${decoded.id} authenticated`);
    next();

  } catch (error) {
    console.error(`[AUTH] ✗ Authentication failed: ${error.message}`);

    if (error.message.includes('expired')) {
      return res.status(401).json({
        status: 'error',
        message: 'Access token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(401).json({
      status: 'error',
      message: 'Invalid or malformed token',
      details: error.message
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't fail if missing
 * 
 * Usage for public endpoints that can accept optional auth
 */
async function optionalAuthenticateJWT(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      // No token provided, continue without user
      req.user = null;
      return next();
    }

    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      // Invalid format, continue without user
      req.user = null;
      return next();
    }

    // Try to verify token
    try {
      const decoded = verifyAccessToken(token);
      req.user = decoded;
      req.token = token;
      console.log(`[AUTH] ✓ Optional user ${decoded.id} authenticated`);
    } catch (error) {
      // Token invalid, continue without user
      req.user = null;
      console.log(`[AUTH] Optional auth failed (continuing): ${error.message}`);
    }

    next();

  } catch (error) {
    // Continue anyway on unexpected errors
    req.user = null;
    next();
  }
}

/**
 * Middleware to verify user role/permission
 * Must be used after authenticateJWT middleware
 * 
 * Usage:
 * router.delete('/admin/users/:id', authenticateJWT, requireRole('admin'), deleteUser);
 */
function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    if (req.user.role !== requiredRole) {
      console.warn(`[AUTH] User ${req.user.id} attempted to access ${requiredRole} resource`);
      
      return res.status(403).json({
        status: 'error',
        message: 'Insufficient permissions',
        details: `This action requires ${requiredRole} role`
      });
    }

    next();
  };
}

/**
 * Middleware to verify user owns the resource
 * Compares req.user.id with resource owner ID
 * 
 * Usage:
 * router.get('/users/:userId/purchases', authenticateJWT, ownsResource, getPurchases);
 */
function ownsResource(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required'
    });
  }

  // Get user ID from URL parameter or body
  const resourceUserId = parseInt(req.params.userId) || parseInt(req.body.userId);

  if (!resourceUserId) {
    return res.status(400).json({
      status: 'error',
      message: 'User ID is required in request'
    });
  }

  // Verify ownership (users can only access their own data)
  if (req.user.id !== resourceUserId && req.user.role !== 'admin') {
    console.warn(`[AUTH] User ${req.user.id} attempted to access user ${resourceUserId} data`);
    
    return res.status(403).json({
      status: 'error',
      message: 'Unauthorized access',
      details: 'You can only access your own data'
    });
  }

  next();
}

/**
 * Middleware for rate limiting
 * Prevents abuse by limiting requests per IP/user
 * 
 * Usage:
 * app.use(rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 100 }));
 */
function rateLimit(options = {}) {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
  const maxRequests = options.maxRequests || 100;
  const store = {}; // In production, use Redis

  return (req, res, next) => {
    const key = req.user ? `user_${req.user.id}` : req.ip;
    const now = Date.now();

    if (!store[key]) {
      store[key] = { count: 0, resetTime: now + windowMs };
    }

    if (now > store[key].resetTime) {
      store[key] = { count: 0, resetTime: now + windowMs };
    }

    store[key].count++;

    if (store[key].count > maxRequests) {
      return res.status(429).json({
        status: 'error',
        message: 'Too many requests',
        details: `Rate limit exceeded. Please try again after ${Math.ceil((store[key].resetTime - now) / 1000)} seconds`
      });
    }

    next();
  };
}

/**
 * Error handling middleware for authentication errors
 */
function handleAuthError(err, req, res, next) {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized',
      details: err.message
    });
  }

  next(err);
}

module.exports = {
  authenticateJWT,
  optionalAuthenticateJWT,
  requireRole,
  ownsResource,
  rateLimit,
  handleAuthError
};
