/**
 * SMM Panel Client - Example Usage
 * 
 * This file demonstrates how to interact with the SMM Panel Server API
 * from a frontend application (React, Vue, vanilla JavaScript, etc.)
 */

// ============================================
// 1. CONFIGURATION
// ============================================

const API_BASE_URL = 'http://localhost:3000/api';
const USER_ID = 1; // Replace with actual authenticated user ID

// ============================================
// 2. HELPER FUNCTION - API Request Wrapper
// ============================================

/**
 * Make an API request with authentication header
 * @param {string} endpoint - API endpoint path
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {Object} body - Request body (optional)
 * @returns {Promise<Object>} - API response
 */
async function apiRequest(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method: method,
      headers: {
        'x-user-id': USER_ID.toString(),
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

    // Parse response
    const data = await response.json();

    // Handle errors
    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return data;
  } catch (error) {
    console.error(`API Request Error: ${error.message}`);
    throw error;
  }
}

// ============================================
// 3. CHECKOUT FUNCTION
// ============================================

/**
 * Purchase social media accounts
 * @param {number} quantity - Number of accounts to purchase
 * @param {number} basePrice - Base price per account
 * @param {number} markupPercentage - Profit markup (default: 30%)
 * @returns {Promise<Object>} - Purchase result with logs
 */
async function purchaseAccounts(quantity, basePrice, markupPercentage = 30) {
  console.log(`[PURCHASE] Initiating purchase for ${quantity} accounts...`);

  try {
    const response = await apiRequest('/checkout', 'POST', {
      quantity: quantity,
      basePrice: basePrice,
      markupPercentage: markupPercentage
    });

    console.log(`[PURCHASE] ✓ Success! Received ${response.data.logs.length} accounts`);
    console.log(`[PURCHASE] Order ID: ${response.data.orderId}`);
    console.log(`[PURCHASE] Total Price: $${response.data.totalPrice}`);
    console.log(`[PURCHASE] New Balance: $${response.data.newBalance}`);

    return response.data;
  } catch (error) {
    console.error(`[PURCHASE] ✗ Failed: ${error.message}`);
    throw error;
  }
}

// ============================================
// 4. GET USER'S PURCHASES
// ============================================

/**
 * Retrieve all purchased accounts for the user
 * @returns {Promise<Array>} - Array of purchased logs
 */
async function getMyPurchases() {
  console.log(`[PURCHASES] Fetching your purchases...`);

  try {
    const response = await apiRequest('/checkout/my-purchases', 'GET');

    console.log(`[PURCHASES] ✓ Retrieved ${response.data.total} purchases`);

    return response.data.logs;
  } catch (error) {
    console.error(`[PURCHASES] ✗ Failed: ${error.message}`);
    throw error;
  }
}

// ============================================
// 5. GET USER'S ORDERS
// ============================================

/**
 * Retrieve all orders placed by the user
 * @returns {Promise<Array>} - Array of orders
 */
async function getMyOrders() {
  console.log(`[ORDERS] Fetching your orders...`);

  try {
    const response = await apiRequest('/checkout/my-orders', 'GET');

    console.log(`[ORDERS] ✓ Retrieved ${response.data.total} orders`);

    return response.data.orders;
  } catch (error) {
    console.error(`[ORDERS] ✗ Failed: ${error.message}`);
    throw error;
  }
}

// ============================================
// 6. GET SPECIFIC PURCHASE
// ============================================

/**
 * Get details of a specific purchased log
 * @param {number} logId - Purchase log ID
 * @returns {Promise<Object>} - Log details
 */
async function getPurchaseDetails(logId) {
  console.log(`[PURCHASE_DETAIL] Fetching purchase ${logId}...`);

  try {
    const response = await apiRequest(`/checkout/purchase/${logId}`, 'GET');

    console.log(`[PURCHASE_DETAIL] ✓ Retrieved purchase details`);
    console.log(`Username: ${response.data.username}`);
    console.log(`Platform: ${response.data.platform}`);
    console.log(`Price: $${response.data.price}`);

    return response.data;
  } catch (error) {
    console.error(`[PURCHASE_DETAIL] ✗ Failed: ${error.message}`);
    throw error;
  }
}

// ============================================
// 7. DISPLAY PURCHASE RESULTS
// ============================================

/**
 * Display purchase results in a formatted table
 * @param {Object} purchaseData - Data from checkout response
 */
function displayPurchaseResults(purchaseData) {
  console.log('\n' + '='.repeat(80));
  console.log('PURCHASE RESULTS');
  console.log('='.repeat(80));
  console.log(`Order ID:          ${purchaseData.orderId}`);
  console.log(`Quantity:          ${purchaseData.quantity}`);
  console.log(`Accounts Received: ${purchaseData.accountsReceived}`);
  console.log(`Total Price:       $${purchaseData.totalPrice}`);
  console.log(`Price Per Account: $${purchaseData.pricePerAccount}`);
  console.log(`New Balance:       $${purchaseData.newBalance}`);
  console.log('='.repeat(80));
  console.log('ACCOUNTS:');
  console.log('-'.repeat(80));

  purchaseData.logs.forEach((log, index) => {
    console.log(`${index + 1}. ${log.username}`);
    console.log(`   Platform: ${log.platform}`);
    console.log(`   Email: ${log.email}`);
    console.log(`   Phone: ${log.phone}`);
    console.log(`   Password: ${log.password}`);
    console.log(`   Cookies: ${log.cookies.substring(0, 50)}...`);
    console.log(`   Price: $${log.price}`);
    console.log('-'.repeat(80));
  });
}

// ============================================
// 8. DISPLAY PURCHASES LIST
// ============================================

/**
 * Display all purchases in a table format
 * @param {Array} logs - Array of purchased logs
 */
function displayPurchasesList(logs) {
  console.log('\n' + '='.repeat(100));
  console.log('MY PURCHASES');
  console.log('='.repeat(100));
  console.log(
    'ID'.padEnd(5) +
    'Username'.padEnd(25) +
    'Platform'.padEnd(15) +
    'Email'.padEnd(30) +
    'Price'.padEnd(10) +
    'Status'.padEnd(10) +
    'Created'.padEnd(20)
  );
  console.log('-'.repeat(100));

  logs.forEach((log) => {
    const createdDate = new Date(log.created_at).toLocaleDateString();
    console.log(
      log.id.toString().padEnd(5) +
      (log.username || 'N/A').padEnd(25) +
      (log.platform || 'N/A').padEnd(15) +
      (log.email || 'N/A').padEnd(30) +
      `$${log.price}`.padEnd(10) +
      log.status.padEnd(10) +
      createdDate.padEnd(20)
    );
  });

  console.log('='.repeat(100));
  console.log(`Total Purchases: ${logs.length}`);
}

// ============================================
// 9. DISPLAY ORDERS LIST
// ============================================

/**
 * Display all orders in a table format
 * @param {Array} orders - Array of orders
 */
function displayOrdersList(orders) {
  console.log('\n' + '='.repeat(90));
  console.log('MY ORDERS');
  console.log('='.repeat(90));
  console.log(
    'ID'.padEnd(5) +
    'Quantity'.padEnd(12) +
    'Total Price'.padEnd(15) +
    'Status'.padEnd(15) +
    'Created'.padEnd(20) +
    'Updated'.padEnd(20)
  );
  console.log('-'.repeat(90));

  orders.forEach((order) => {
    const createdDate = new Date(order.created_at).toLocaleDateString();
    const updatedDate = new Date(order.updated_at).toLocaleDateString();
    console.log(
      order.id.toString().padEnd(5) +
      order.quantity.toString().padEnd(12) +
      `$${order.total_price}`.padEnd(15) +
      order.status.padEnd(15) +
      createdDate.padEnd(20) +
      updatedDate.padEnd(20)
    );
  });

  console.log('='.repeat(90));
  console.log(`Total Orders: ${orders.length}`);
}

// ============================================
// 10. EXAMPLE USAGE
// ============================================

/**
 * Run example usage scenarios
 * Uncomment sections to test different functionality
 */
async function runExamples() {
  try {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   SMM PANEL CLIENT - EXAMPLE USAGE     ║');
    console.log('╚═════════════════════════════════��══════╝\n');

    // Example 1: Purchase accounts
    console.log('\n--- EXAMPLE 1: PURCHASE ACCOUNTS ---');
    const purchaseResult = await purchaseAccounts(5, 10, 30);
    displayPurchaseResults(purchaseResult);

    // Example 2: Get user's purchases
    console.log('\n--- EXAMPLE 2: GET MY PURCHASES ---');
    const purchases = await getMyPurchases();
    displayPurchasesList(purchases);

    // Example 3: Get user's orders
    console.log('\n--- EXAMPLE 3: GET MY ORDERS ---');
    const orders = await getMyOrders();
    displayOrdersList(orders);

    // Example 4: Get specific purchase
    if (purchases.length > 0) {
      console.log('\n--- EXAMPLE 4: GET PURCHASE DETAILS ---');
      const details = await getPurchaseDetails(purchases[0].id);
      console.log('Purchase Details:', details);
    }

  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// ============================================
// 11. REACT COMPONENT EXAMPLE
// ============================================

/**
 * Example React component for checkout
 * 
 * Usage:
 * <CheckoutForm />
 */
/*
import React, { useState } from 'react';

export function CheckoutForm() {
  const [quantity, setQuantity] = useState(5);
  const [basePrice, setBasePrice] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCheckout = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await purchaseAccounts(quantity, basePrice, 30);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="checkout-form">
      <form onSubmit={handleCheckout}>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value))}
          placeholder="Quantity"
        />
        <input
          type="number"
          step="0.01"
          value={basePrice}
          onChange={(e) => setBasePrice(parseFloat(e.target.value))}
          placeholder="Base Price"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Processing...' : 'Checkout'}
        </button>
      </form>

      {error && <div className="error">{error}</div>}
      {result && (
        <div className="success">
          <h2>Purchase Successful!</h2>
          <p>Order ID: {result.orderId}</p>
          <p>Total Price: ${result.totalPrice}</p>
          <p>Accounts Received: {result.accountsReceived}</p>
        </div>
      )}
    </div>
  );
}
*/

// ============================================
// 12. EXPORT FOR USE IN OTHER FILES
// ============================================

// If using ES6 modules:
// export { purchaseAccounts, getMyPurchases, getMyOrders, getPurchaseDetails };

// If using CommonJS:
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    apiRequest,
    purchaseAccounts,
    getMyPurchases,
    getMyOrders,
    getPurchaseDetails,
    displayPurchaseResults,
    displayPurchasesList,
    displayOrdersList,
    runExamples
  };
}

// ============================================
// 13. RUN EXAMPLES (Uncomment to test)
// ============================================

// Uncomment the line below to run example usage
// runExamples();
