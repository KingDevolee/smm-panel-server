require('dotenv').config();
const axios = require('axios');

/**
 * Monnify Payment Gateway Service
 * Integrates with Monnify API for payment processing
 * Documentation: https://documentation.monnify.com/
 */

const MONNIFY_API_KEY = process.env.MONNIFY_API_KEY;
const MONNIFY_SECRET_KEY = process.env.MONNIFY_SECRET_KEY;
const MONNIFY_BASE_URL = process.env.MONNIFY_BASE_URL || 'https://api.monnify.com';
const MONNIFY_CONTRACT_CODE = process.env.MONNIFY_CONTRACT_CODE;

// Validate required environment variables
function validateMonnifyConfig() {
  if (!MONNIFY_API_KEY || !MONNIFY_SECRET_KEY || !MONNIFY_CONTRACT_CODE) {
    console.error('[MONNIFY] Missing required configuration');
    console.error('[MONNIFY] Required: MONNIFY_API_KEY, MONNIFY_SECRET_KEY, MONNIFY_CONTRACT_CODE');
    throw new Error('Monnify configuration incomplete');
  }
}

/**
 * Create Monnify API client with authentication
 * @returns {Object} - Configured axios instance
 */
function createMonnifyClient() {
  validateMonnifyConfig();

  // Encode credentials for Basic Auth
  const credentials = Buffer.from(`${MONNIFY_API_KEY}:${MONNIFY_SECRET_KEY}`).toString('base64');

  const client = axios.create({
    baseURL: MONNIFY_BASE_URL,
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });

  return client;
}

/**
 * Initialize a payment transaction with Monnify
 * 
 * @param {Object} paymentData - Payment details
 * @param {number} paymentData.amount - Amount in kobo (1 Naira = 100 kobo)
 * @param {string} paymentData.customerEmail - Customer email address
 * @param {string} paymentData.customerName - Customer full name
 * @param {string} paymentData.description - Payment description/reference
 * @param {string} paymentData.orderId - Unique order ID
 * @param {string} paymentData.redirectUrl - URL to redirect after payment
 * @returns {Promise<Object>} - Payment initialization response
 */
async function initializePayment(paymentData) {
  try {
    const { amount, customerEmail, customerName, description, orderId, redirectUrl } = paymentData;

    // Validate input
    if (!amount || !customerEmail || !customerName || !orderId) {
      throw new Error('Missing required payment data: amount, customerEmail, customerName, orderId');
    }

    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    console.log(`[MONNIFY] Initializing payment for order ${orderId}, amount: ₦${amount / 100}`);

    const client = createMonnifyClient();

    const response = await client.post('/api/v1/transactions/init', {
      amount: amount,
      customerEmail: customerEmail,
      customerName: customerName,
      paymentDescription: description || `Payment for order ${orderId}`,
      paymentReference: `ORDER_${orderId}_${Date.now()}`,
      contractCode: MONNIFY_CONTRACT_CODE,
      redirectUrl: redirectUrl || `${process.env.APP_URL || 'http://localhost:3000'}/payment/verify`,
      paymentMethods: ['CARD', 'ACCOUNT_TRANSFER', 'USSD']
    });

    if (response.data.requestSuccessful && response.data.responseBody) {
      const payment = response.data.responseBody;
      
      console.log(`[MONNIFY] ✓ Payment initialized successfully`);
      console.log(`[MONNIFY] Authorization URL: ${payment.checkoutUrl}`);

      return {
        status: 'success',
        paymentLink: payment.checkoutUrl,
        accessCode: payment.accessCode,
        paymentReference: payment.transactionReference,
        amount: amount / 100, // Convert back to Naira
        orderId: orderId,
        createdAt: new Date().toISOString()
      };
    } else {
      throw new Error(response.data.responseMessage || 'Failed to initialize payment');
    }

  } catch (error) {
    console.error(`[MONNIFY] Error initializing payment: ${error.message}`);
    throw new Error(`Monnify payment initialization failed: ${error.message}`);
  }
}

/**
 * Verify payment transaction status
 * 
 * @param {string} paymentReference - Payment reference from Monnify
 * @returns {Promise<Object>} - Payment verification response
 */
async function verifyPayment(paymentReference) {
  try {
    if (!paymentReference) {
      throw new Error('Payment reference is required');
    }

    console.log(`[MONNIFY] Verifying payment with reference: ${paymentReference}`);

    const client = createMonnifyClient();

    const response = await client.get(`/api/v1/transactions/verify/${paymentReference}`);

    if (response.data.requestSuccessful && response.data.responseBody) {
      const payment = response.data.responseBody;
      
      console.log(`[MONNIFY] Payment status: ${payment.paymentStatus}`);

      return {
        status: payment.paymentStatus === 'SUCCESSFUL' ? 'success' : payment.paymentStatus,
        paymentReference: payment.transactionReference,
        amount: payment.amountPaid / 100, // Convert to Naira
        customerEmail: payment.customerEmail,
        paymentMethod: payment.paymentMethod,
        timestamp: payment.paidOn,
        isVerified: payment.paymentStatus === 'SUCCESSFUL'
      };
    } else {
      throw new Error(response.data.responseMessage || 'Failed to verify payment');
    }

  } catch (error) {
    console.error(`[MONNIFY] Error verifying payment: ${error.message}`);
    throw new Error(`Monnify payment verification failed: ${error.message}`);
  }
}

/**
 * Get payment transaction details
 * 
 * @param {string} paymentReference - Payment reference
 * @returns {Promise<Object>} - Transaction details
 */
async function getTransactionDetails(paymentReference) {
  try {
    if (!paymentReference) {
      throw new Error('Payment reference is required');
    }

    console.log(`[MONNIFY] Fetching transaction details for: ${paymentReference}`);

    const client = createMonnifyClient();

    const response = await client.get(`/api/v1/transactions/${paymentReference}`);

    if (response.data.requestSuccessful && response.data.responseBody) {
      const transaction = response.data.responseBody;

      return {
        reference: transaction.transactionReference,
        amount: transaction.amountPaid / 100,
        status: transaction.paymentStatus,
        customerEmail: transaction.customerEmail,
        paymentMethod: transaction.paymentMethod,
        paidOn: transaction.paidOn,
        description: transaction.paymentDescription,
        metadata: transaction.metadata
      };
    } else {
      throw new Error(response.data.responseMessage || 'Failed to fetch transaction');
    }

  } catch (error) {
    console.error(`[MONNIFY] Error fetching transaction: ${error.message}`);
    throw new Error(`Monnify transaction fetch failed: ${error.message}`);
  }
}

/**
 * Calculate amount in kobo (Monnify uses kobo as base unit)
 * @param {number} naira - Amount in Nigerian Naira
 * @returns {number} - Amount in kobo
 */
function convertToKobo(naira) {
  if (!naira || naira < 0) {
    throw new Error('Invalid amount');
  }
  return Math.round(naira * 100);
}

/**
 * Convert kobo back to Naira
 * @param {number} kobo - Amount in kobo
 * @returns {number} - Amount in Naira
 */
function convertToNaira(kobo) {
  if (!kobo || kobo < 0) {
    throw new Error('Invalid amount');
  }
  return kobo / 100;
}

/**
 * Create a payment for account purchase
 * 
 * @param {Object} paymentData - Payment data
 * @param {number} paymentData.userId - User ID
 * @param {number} paymentData.amount - Amount in Naira
 * @param {string} paymentData.customerEmail - Customer email
 * @param {string} paymentData.customerName - Customer name
 * @param {number} paymentData.quantity - Number of accounts
 * @param {string} paymentData.redirectUrl - Redirect URL
 * @returns {Promise<Object>} - Payment link and details
 */
async function createAccountPurchasePayment(paymentData) {
  try {
    const { userId, amount, customerEmail, customerName, quantity, redirectUrl } = paymentData;

    if (!userId || !amount || !quantity) {
      throw new Error('Missing required fields: userId, amount, quantity');
    }

    const orderId = `USER_${userId}_ORD_${Date.now()}`;
    const amountInKobo = convertToKobo(amount);

    console.log(`[MONNIFY] Creating payment for user ${userId}: ${quantity} accounts, ₦${amount}`);

    const response = await initializePayment({
      amount: amountInKobo,
      customerEmail: customerEmail,
      customerName: customerName,
      description: `Purchase of ${quantity} social media accounts`,
      orderId: orderId,
      redirectUrl: redirectUrl
    });

    return {
      ...response,
      quantity: quantity,
      userId: userId
    };

  } catch (error) {
    console.error(`[MONNIFY] Error creating purchase payment: ${error.message}`);
    throw error;
  }
}

/**
 * Webhook handler for Monnify payment notifications
 * This should be called when Monnify sends payment status updates
 * 
 * @param {Object} webhookData - Data from Monnify webhook
 * @returns {Object} - Webhook processing result
 */
function handlePaymentWebhook(webhookData) {
  try {
    const { transactionReference, paymentStatus, amountPaid, customerEmail } = webhookData;

    console.log(`[MONNIFY] Webhook received for: ${transactionReference}, Status: ${paymentStatus}`);

    if (!transactionReference || !paymentStatus) {
      throw new Error('Invalid webhook data');
    }

    return {
      success: true,
      transactionReference: transactionReference,
      paymentStatus: paymentStatus,
      amountPaid: amountPaid / 100,
      customerEmail: customerEmail,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`[MONNIFY] Error processing webhook: ${error.message}`);
    throw error;
  }
}

module.exports = {
  initializePayment,
  verifyPayment,
  getTransactionDetails,
  createAccountPurchasePayment,
  handlePaymentWebhook,
  convertToKobo,
  convertToNaira,
  validateMonnifyConfig,
  MONNIFY_BASE_URL,
  MONNIFY_CONTRACT_CODE
};
