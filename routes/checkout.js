require('dotenv').config();
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const User = require('../models/User');
const Order = require('../models/Order');
const PurchasedLog = require('../models/PurchasedLog');
const { orderFromSupplier } = require('../services/supplierService');
const { calculateRetailPrice } = require('../services/pricingService');

/**
 * Middleware to verify user authentication
 * Extracts user ID from request headers or body
 * In production, this would verify JWT tokens or sessions
 */
async function authenticateUser(req, res, next) {
  try {
    // Get user ID from request header (x-user-id) or body (userId)
    // In production, extract from JWT token: const userId = req.user.id from JWT middleware
    const userId = req.headers['x-user-id'] || req.body.userId;
    
    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required. Please provide user ID in x-user-id header or userId in body'
      });
    }

    // Verify user exists in database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Attach user to request for use in route handlers
    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * POST /api/checkout
 * Process checkout: deduct price from balance, fetch logs from supplier, save to database
 * 
 * Request body:
 * {
 *   "quantity": 10,
 *   "productId": "social_media_accounts",  // optional, defaults to SUPPLIER_PRODUCT_ID env var
 *   "basePrice": 10,                        // base price per account from supplier
 *   "markupPercentage": 30                  // optional, defaults to 30%
 * }
 * 
 * Headers:
 * {
 *   "x-user-id": 1                         // authenticated user ID
 * }
 * 
 * Response on success (200):
 * {
 *   "status": "success",
 *   "message": "Purchase completed successfully",
 *   "data": {
 *     "orderId": 1,
 *     "quantity": 10,
 *     "accountsReceived": 10,
 *     "totalPrice": 130,
 *     "pricePerAccount": 13,
 *     "newBalance": 870,
 *     "logs": [
 *       {
 *         "id": 1,
 *         "username": "account1",
 *         "password": "pass123",
 *         "cookies": "session_cookie",
 *         "platform": "instagram",
 *         "email": "account@example.com",
 *         "phone": "+1234567890",
 *         "price": 13
 *       }
 *     ]
 *   }
 * }
 * 
 * Response on error (400/401/402/500/502):
 * {
 *   "status": "error",
 *   "message": "Error description"
 * }
 */
router.post('/checkout', authenticateUser, async (req, res) => {
  let connection = null;
  
  try {
    // Get connection from pool
    connection = await pool.getConnection();
    
    // Extract and validate request body
    const { quantity, productId, basePrice, markupPercentage = 30 } = req.body;

    // Validate quantity
    if (!quantity || quantity <= 0 || !Number.isInteger(quantity)) {
      return res.status(400).json({
        status: 'error',
        message: 'Quantity must be a positive integer'
      });
    }

    // Validate base price
    if (basePrice === undefined || basePrice === null || basePrice < 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid base price is required'
      });
    }

    // Get user ID
    const userId = req.user.id;

    // Get environment variables for logging
    const nodeEnv = process.env.NODE_ENV || 'development';
    const logPrefix = `[${nodeEnv.toUpperCase()}] [CHECKOUT]`;

    // Calculate retail price per unit
    const retailPricePerUnit = calculateRetailPrice(basePrice, markupPercentage);
    const totalPrice = Math.round(retailPricePerUnit * quantity * 100) / 100;

    // Check if user has sufficient balance
    if (req.user.balance < totalPrice) {
      console.warn(`${logPrefix} Insufficient balance for user ${userId}. Required: $${totalPrice}, Available: $${req.user.balance}`);
      
      return res.status(402).json({
        status: 'error',
        message: `Insufficient balance. Required: $${totalPrice}, Available: $${req.user.balance}`
      });
    }

    console.log(`${logPrefix} User ${userId} purchasing ${quantity} accounts for $${totalPrice}`);

    // ========== STEP 1: Deduct price from user balance ==========
    console.log(`${logPrefix} Deducting $${totalPrice} from user ${userId} balance`);
    const updatedUser = await User.updateBalance(userId, -totalPrice);

    if (!updatedUser) {
      console.error(`${logPrefix} Failed to update user balance for user ${userId}`);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update user balance'
      });
    }

    console.log(`${logPrefix} User balance updated. New balance: $${updatedUser.balance}`);

    // ========== STEP 2: Create order record ==========
    console.log(`${logPrefix} Creating order record for user ${userId}`);
    const order = await Order.create(
      userId,
      productId || process.env.SUPPLIER_PRODUCT_ID,
      quantity,
      totalPrice,
      'processing'
    );

    console.log(`${logPrefix} Order ${order.id} created with status: processing`);

    // ========== STEP 3: Call supplier API to fetch logs ==========
    console.log(`${logPrefix} Calling supplier API (${process.env.SUPPLIER_API_URL}) to fetch ${quantity} accounts`);
    
    let supplierLogs;
    try {
      supplierLogs = await orderFromSupplier(quantity, productId || process.env.SUPPLIER_PRODUCT_ID);
      console.log(`${logPrefix} Supplier API returned ${supplierLogs.length} accounts`);
    } catch (error) {
      console.error(`${logPrefix} Supplier API error: ${error.message}`);
      
      // Refund user balance on supplier error
      console.log(`${logPrefix} Refunding $${totalPrice} to user ${userId} due to supplier error`);
      await User.updateBalance(userId, totalPrice);
      await Order.updateStatus(order.id, 'failed');

      return res.status(502).json({
        status: 'error',
        message: `Failed to fetch accounts from supplier: ${error.message}`
      });
    }

    // Validate supplier response
    if (!supplierLogs || supplierLogs.length === 0) {
      console.error(`${logPrefix} Supplier returned no accounts for order ${order.id}`);
      
      // Refund user balance
      await User.updateBalance(userId, totalPrice);
      await Order.updateStatus(order.id, 'failed');

      return res.status(502).json({
        status: 'error',
        message: 'Supplier API returned no accounts'
      });
    }

    // ========== STEP 4: Save delivered logs to database ==========
    console.log(`${logPrefix} Saving ${supplierLogs.length} logs to database for user ${userId}, order ${order.id}`);
    const savedLogs = [];

    for (const log of supplierLogs) {
      try {
        const purchasedLog = await PurchasedLog.create(
          userId,
          order.id,
          log.username,
          log.password,
          log.cookies,
          log.platform || 'unknown',
          log.email || '',
          log.phone || '',
          log.order_id || '',
          retailPricePerUnit
        );
        
        savedLogs.push({
          id: purchasedLog.id,
          username: log.username,
          password: log.password,
          cookies: log.cookies,
          platform: log.platform,
          email: log.email,
          phone: log.phone,
          price: retailPricePerUnit
        });

        console.log(`${logPrefix} Saved log ID ${purchasedLog.id} for account ${log.username}`);
      } catch (error) {
        console.error(`${logPrefix} Failed to save log for account ${log.username}: ${error.message}`);
      }
    }

    // Verify all logs were saved
    if (savedLogs.length === 0) {
      console.error(`${logPrefix} Failed to save any logs to database for order ${order.id}`);
      
      // Refund user balance
      await User.updateBalance(userId, totalPrice);
      await Order.updateStatus(order.id, 'failed');

      return res.status(500).json({
        status: 'error',
        message: 'Failed to save purchased accounts to database'
      });
    }

    console.log(`${logPrefix} Successfully saved ${savedLogs.length} logs to database`);

    // ========== STEP 5: Update order status to completed ==========
    console.log(`${logPrefix} Marking order ${order.id} as completed`);
    await Order.updateStatus(order.id, 'completed');

    console.log(`${logPrefix} Order ${order.id} completed successfully for user ${userId}`);

    // ========== Return success response ==========
    return res.status(200).json({
      status: 'success',
      message: 'Purchase completed successfully',
      data: {
        orderId: order.id,
        quantity: quantity,
        accountsReceived: savedLogs.length,
        totalPrice: totalPrice,
        pricePerAccount: retailPricePerUnit,
        newBalance: updatedUser.balance,
        logs: savedLogs
      }
    });

  } catch (error) {
    console.error(`[CHECKOUT] Unexpected error: ${error.message}`);
    console.error(error.stack);

    return res.status(500).json({
      status: 'error',
      message: 'An unexpected error occurred during checkout',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * GET /api/checkout/my-purchases
 * Get all purchased logs for the authenticated user
 * 
 * Headers:
 * {
 *   "x-user-id": 1
 * }
 * 
 * Response:
 * {
 *   "status": "success",
 *   "data": {
 *     "total": 2,
 *     "logs": [...]
 *   }
 * }
 */
router.get('/my-purchases', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const nodeEnv = process.env.NODE_ENV || 'development';

    console.log(`[${nodeEnv.toUpperCase()}] [PURCHASES] Fetching all purchases for user ${userId}`);

    const logs = await PurchasedLog.findByUserId(userId);

    return res.status(200).json({
      status: 'success',
      data: {
        total: logs.length,
        logs: logs
      }
    });

  } catch (error) {
    console.error(`[PURCHASES] Error: ${error.message}`);
    
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * GET /api/checkout/my-orders
 * Get all orders for the authenticated user
 * 
 * Headers:
 * {
 *   "x-user-id": 1
 * }
 * 
 * Response:
 * {
 *   "status": "success",
 *   "data": {
 *     "total": 2,
 *     "orders": [...]
 *   }
 * }
 */
router.get('/my-orders', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const nodeEnv = process.env.NODE_ENV || 'development';

    console.log(`[${nodeEnv.toUpperCase()}] [ORDERS] Fetching all orders for user ${userId}`);

    const orders = await Order.findByUserId(userId);

    return res.status(200).json({
      status: 'success',
      data: {
        total: orders.length,
        orders: orders
      }
    });

  } catch (error) {
    console.error(`[ORDERS] Error: ${error.message}`);
    
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * GET /api/checkout/purchase/:logId
 * Get a specific purchased log by ID
 * Verifies user owns the log before returning details
 * 
 * Headers:
 * {
 *   "x-user-id": 1
 * }
 * 
 * Response:
 * {
 *   "status": "success",
 *   "data": { log object }
 * }
 */
router.get('/purchase/:logId', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const logId = req.params.logId;
    const nodeEnv = process.env.NODE_ENV || 'development';

    if (!logId || !Number.isInteger(parseInt(logId))) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid log ID is required'
      });
    }

    console.log(`[${nodeEnv.toUpperCase()}] [PURCHASE] Fetching log ${logId} for user ${userId}`);

    const log = await PurchasedLog.findById(logId);

    if (!log) {
      return res.status(404).json({
        status: 'error',
        message: 'Log not found'
      });
    }

    // Verify log belongs to authenticated user
    if (log.user_id !== userId) {
      console.warn(`[${nodeEnv.toUpperCase()}] [PURCHASE] Unauthorized access attempt: User ${userId} tried to access log ${logId} owned by user ${log.user_id}`);
      
      return res.status(403).json({
        status: 'error',
        message: 'Unauthorized: You do not have access to this log'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: log
    });

  } catch (error) {
    console.error(`[PURCHASE] Error: ${error.message}`);
    
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;
