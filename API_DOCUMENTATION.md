````markdown name=API_DOCUMENTATION.md
# SMM Panel Server - API Documentation

## Overview

The SMM Panel Server is a Node.js Express application that manages social media account purchases, integrates with external supplier APIs, and handles user balances with dynamic pricing.

## Base URL

```
http://localhost:3000/api
```

## Environment Variables

All endpoints use environment variables configured via `.env` file:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=smm_panel

# Server Configuration
PORT=3000
NODE_ENV=development

# Supplier API Configuration
SUPPLIER_API_URL=https://api.supplier.com
SUPPLIER_API_KEY=your_supplier_api_key
SUPPLIER_PRODUCT_ID=social_media_accounts
```

## Authentication

All protected endpoints require user authentication via the `x-user-id` header:

```bash
curl -X GET http://localhost:3000/api/checkout/my-purchases \
  -H "x-user-id: 1"
```

In production, replace this with JWT token validation.

---

## Endpoints

### 1. Health Check

#### `GET /health`

Check if the server is running.

**Request:**
```bash
curl http://localhost:3000/health
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "message": "SMM Panel Server is running",
  "environment": "development",
  "timestamp": "2026-08-26T10:30:00.000Z"
}
```

---

### 2. Database Connection Test

#### `GET /test-db`

Test database connectivity.

**Request:**
```bash
curl http://localhost:3000/test-db
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "message": "Database connection successful",
  "database": "smm_panel",
  "host": "localhost"
}
```

**Response (500 Error):**
```json
{
  "status": "error",
  "message": "Database connection failed",
  "error": "Error details"
}
```

---

### 3. Checkout - Purchase Social Media Accounts

#### `POST /checkout`

Process a purchase: deduct balance, fetch accounts from supplier, save logs to database.

**Headers:**
```
x-user-id: 1
Content-Type: application/json
```

**Request Body:**
```json
{
  "quantity": 10,
  "productId": "social_media_accounts",
  "basePrice": 10,
  "markupPercentage": 30
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| quantity | integer | ✓ | Number of accounts to purchase (positive integer) |
| productId | string | ✗ | Supplier product ID (defaults to env `SUPPLIER_PRODUCT_ID`) |
| basePrice | number | ✓ | Base price per account from supplier |
| markupPercentage | number | ✗ | Profit markup percentage (default: 30) |

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/checkout \
  -H "x-user-id: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 5,
    "basePrice": 10,
    "markupPercentage": 30
  }'
```

**Response (200 OK) - Success:**
```json
{
  "status": "success",
  "message": "Purchase completed successfully",
  "data": {
    "orderId": 1,
    "quantity": 5,
    "accountsReceived": 5,
    "totalPrice": 65,
    "pricePerAccount": 13,
    "newBalance": 935,
    "logs": [
      {
        "id": 1,
        "username": "instagram_account_1",
        "password": "secure_password_123",
        "cookies": "session_cookie_data",
        "platform": "instagram",
        "email": "account1@example.com",
        "phone": "+1234567890",
        "price": 13
      },
      {
        "id": 2,
        "username": "instagram_account_2",
        "password": "secure_password_456",
        "cookies": "session_cookie_data_2",
        "platform": "instagram",
        "email": "account2@example.com",
        "phone": "+0987654321",
        "price": 13
      }
    ]
  }
}
```

**Response (400 Bad Request) - Invalid Input:**
```json
{
  "status": "error",
  "message": "Quantity must be a positive integer"
}
```

**Response (401 Unauthorized) - Missing Auth:**
```json
{
  "status": "error",
  "message": "Authentication required. Please provide user ID in x-user-id header or userId in body"
}
```

**Response (402 Payment Required) - Insufficient Balance:**
```json
{
  "status": "error",
  "message": "Insufficient balance. Required: $65, Available: $30"
}
```

**Response (404 Not Found) - User Not Found:**
```json
{
  "status": "error",
  "message": "User not found"
}
```

**Response (502 Bad Gateway) - Supplier API Error:**
```json
{
  "status": "error",
  "message": "Failed to fetch accounts from supplier: Connection timeout"
}
```

**Response (500 Internal Server Error):**
```json
{
  "status": "error",
  "message": "An unexpected error occurred during checkout"
}
```

**Process Flow:**
1. Validate user authentication
2. Validate request parameters
3. Calculate retail price: `basePrice × (1 + markupPercentage/100)`
4. Calculate total: `retailPrice × quantity`
5. Check user balance
6. **Step 1:** Deduct total price from user balance
7. **Step 2:** Create order record with status "processing"
8. **Step 3:** Call supplier API via `orderFromSupplier()`
9. **Step 4:** Save each delivered log to `purchased_logs` table
10. **Step 5:** Update order status to "completed"
11. Return success response with logs

---

### 4. Get User's Purchases

#### `GET /checkout/my-purchases`

Retrieve all purchased social media accounts for the authenticated user.

**Headers:**
```
x-user-id: 1
```

**Example Request:**
```bash
curl -X GET http://localhost:3000/api/checkout/my-purchases \
  -H "x-user-id: 1"
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "total": 10,
    "logs": [
      {
        "id": 1,
        "user_id": 1,
        "order_id": 1,
        "username": "instagram_account_1",
        "password": "password_123",
        "cookies": "cookie_data",
        "platform": "instagram",
        "email": "account1@example.com",
        "phone": "+1234567890",
        "supplier_order_id": "SUP_001",
        "price": 13,
        "status": "active",
        "created_at": "2026-08-26T10:30:00.000Z"
      }
    ]
  }
}
```

**Response (500 Error):**
```json
{
  "status": "error",
  "message": "Error message"
}
```

---

### 5. Get User's Orders

#### `GET /checkout/my-orders`

Retrieve all orders placed by the authenticated user.

**Headers:**
```
x-user-id: 1
```

**Example Request:**
```bash
curl -X GET http://localhost:3000/api/checkout/my-orders \
  -H "x-user-id: 1"
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "total": 2,
    "orders": [
      {
        "id": 1,
        "user_id": 1,
        "supplier_product_id": "social_media_accounts",
        "quantity": 5,
        "total_price": 65,
        "status": "completed",
        "created_at": "2026-08-26T10:30:00.000Z",
        "updated_at": "2026-08-26T10:31:00.000Z"
      },
      {
        "id": 2,
        "user_id": 1,
        "supplier_product_id": "social_media_accounts",
        "quantity": 10,
        "total_price": 130,
        "status": "completed",
        "created_at": "2026-08-26T11:00:00.000Z",
        "updated_at": "2026-08-26T11:02:00.000Z"
      }
    ]
  }
}
```

---

### 6. Get Specific Purchase

#### `GET /checkout/purchase/:logId`

Retrieve details of a specific purchased log. Only the log owner can access their logs.

**Headers:**
```
x-user-id: 1
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| logId | integer | ✓ | Log ID (in URL path) |

**Example Request:**
```bash
curl -X GET http://localhost:3000/api/checkout/purchase/1 \
  -H "x-user-id: 1"
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "user_id": 1,
    "order_id": 1,
    "username": "instagram_account_1",
    "password": "secure_password",
    "cookies": "session_cookies",
    "platform": "instagram",
    "email": "account@example.com",
    "phone": "+1234567890",
    "supplier_order_id": "SUP_001",
    "price": 13,
    "status": "active",
    "created_at": "2026-08-26T10:30:00.000Z"
  }
}
```

**Response (400 Bad Request) - Invalid Log ID:**
```json
{
  "status": "error",
  "message": "Valid log ID is required"
}
```

**Response (403 Forbidden) - Unauthorized Access:**
```json
{
  "status": "error",
  "message": "Unauthorized: You do not have access to this log"
}
```

**Response (404 Not Found):**
```json
{
  "status": "error",
  "message": "Log not found"
}
```

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  balance DECIMAL(10, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Orders Table
```sql
CREATE TABLE orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  supplier_product_id VARCHAR(255),
  quantity INT NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Purchased Logs Table
```sql
CREATE TABLE purchased_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  order_id INT NOT NULL,
  username VARCHAR(255),
  password VARCHAR(255),
  cookies LONGTEXT,
  platform VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  supplier_order_id VARCHAR(255),
  price DECIMAL(10, 2),
  status ENUM('active', 'expired', 'revoked') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
```

---

## Error Handling

### HTTP Status Codes

| Status | Description |
|--------|-------------|
| 200 | Request successful |
| 400 | Bad request - invalid parameters |
| 401 | Unauthorized - missing/invalid authentication |
| 402 | Payment required - insufficient balance |
| 403 | Forbidden - insufficient permissions |
| 404 | Not found - resource doesn't exist |
| 500 | Internal server error |
| 502 | Bad gateway - supplier API error |

### Error Response Format

```json
{
  "status": "error",
  "message": "Human-readable error message"
}
```

---

## Pricing Calculation

### Retail Price Formula
```
Retail Price = Base Price × (1 + Markup % / 100)
```

### Example
```
Base Price: $10
Markup: 30%
Retail Price: $10 × (1 + 30/100) = $10 × 1.3 = $13
Total for 5 units: $13 × 5 = $65
Profit per unit: $13 - $10 = $3
Total profit: $3 × 5 = $15
```

---

## Usage Examples

### Complete Purchase Flow

```bash
# 1. Check server health
curl http://localhost:3000/health

# 2. Test database connection
curl http://localhost:3000/test-db

# 3. Purchase 5 accounts with $10 base price and 30% markup
curl -X POST http://localhost:3000/api/checkout \
  -H "x-user-id: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 5,
    "basePrice": 10,
    "markupPercentage": 30
  }'

# 4. View all your purchases
curl http://localhost:3000/api/checkout/my-purchases \
  -H "x-user-id: 1"

# 5. View all your orders
curl http://localhost:3000/api/checkout/my-orders \
  -H "x-user-id: 1"

# 6. Get specific purchase details
curl http://localhost:3000/api/checkout/purchase/1 \
  -H "x-user-id: 1"
```

### JavaScript Fetch Examples

```javascript
// Purchase accounts
const response = await fetch('http://localhost:3000/api/checkout', {
  method: 'POST',
  headers: {
    'x-user-id': '1',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    quantity: 5,
    basePrice: 10,
    markupPercentage: 30
  })
});

const data = await response.json();
console.log(data);

// Get user's purchases
const purchasesResponse = await fetch('http://localhost:3000/api/checkout/my-purchases', {
  headers: {
    'x-user-id': '1'
  }
});

const purchases = await purchasesResponse.json();
console.log(purchases);
```

---

## Logging

The server logs all major operations with environment-aware prefixes:

```
[DEVELOPMENT] [CHECKOUT] User 1 purchasing 5 accounts for $65
[DEVELOPMENT] [CHECKOUT] Deducting $65 from user 1 balance
[DEVELOPMENT] [CHECKOUT] Creating order record for user 1
[DEVELOPMENT] [CHECKOUT] Calling supplier API to fetch 5 accounts
```

Set `NODE_ENV=production` to disable detailed logs in error responses.

---

## Security Considerations

- ✅ Passwords are hashed with bcryptjs before storage
- ✅ User balances are validated before transactions
- ✅ Logs are ownership-verified (users can only access their own)
- ✅ Environment variables protect sensitive credentials
- ✅ Error messages don't leak internal system details in production
- ✅ Input validation on all endpoints
- ✅ Database transactions prevent inconsistent states

**Important:** In production:
- Replace `x-user-id` header authentication with JWT tokens
- Enable HTTPS/TLS for all communications
- Use database user with minimal required permissions
- Implement rate limiting
- Add CORS restrictions
- Enable SQL query logging for auditing

---

## Support & Troubleshooting

### Common Issues

**Q: Database connection fails**
- A: Check MySQL is running, verify credentials in `.env`

**Q: Supplier API returns error**
- A: Verify `SUPPLIER_API_URL` and `SUPPLIER_API_KEY` in `.env`

**Q: User balance not deducting**
- A: Ensure user has sufficient balance before checkout

**Q: Logs not saving**
- A: Check database has `purchased_logs` table created

---

## License

MIT License
````
