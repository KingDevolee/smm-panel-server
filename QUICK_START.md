# Quick Start Guide

## Prerequisites

- Node.js v14+ installed
- MySQL v5.7+ installed and running
- npm or yarn package manager

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/KingDevolee/smm-panel-server.git
cd smm-panel-server
```

### 2. Install Dependencies

```bash
npm install
```

This installs all required packages:
- `express` - Web server framework
- `mysql2` - MySQL database driver
- `dotenv` - Environment variable management
- `axios` - HTTP client for supplier API
- `bcryptjs` - Password hashing
- `cors` - Cross-Origin Resource Sharing

### 3. Set Up Database

First, create the database and tables:

```bash
mysql -u root -p < database/init.sql
```

When prompted, enter your MySQL root password.

This creates:
- `smm_panel` database
- `users` table
- `orders` table
- `purchased_logs` table

### 4. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=smm_panel

# Server Configuration
PORT=3000
NODE_ENV=development

# Supplier API Configuration
SUPPLIER_API_URL=https://api.supplier.com
SUPPLIER_API_KEY=your_supplier_api_key
SUPPLIER_PRODUCT_ID=social_media_accounts
```

### 5. Create a Test User (Optional)

Connect to MySQL and add a test user:

```bash
mysql -u root -p smm_panel
```

Then execute:

```sql
-- Add a test user with initial balance
INSERT INTO users (username, email, password_hash, balance) VALUES (
  'testuser',
  'test@example.com',
  '$2a$10$EXAMPLE_HASHED_PASSWORD',
  1000.00
);

-- Get the user ID
SELECT * FROM users;
```

Note: The password hash is a bcryptjs hashed password. For testing, you can generate one using Node.js:

```bash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('password123', 10));"
```

### 6. Start the Server

**Development mode (with auto-reload):**

```bash
npm run dev
```

**Production mode:**

```bash
npm start
```

The server will start on the port specified in `.env` (default: 3000).

Output:
```
✓ Server running on port 3000
✓ Mode: development
✓ Checkout endpoint: POST http://localhost:3000/api/checkout
```

### 7. Test the Server

Check if the server is running:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "SMM Panel Server is running",
  "environment": "development",
  "timestamp": "2026-08-26T10:30:00.000Z"
}
```

Test database connection:

```bash
curl http://localhost:3000/test-db
```

---

## Basic API Usage

### 1. Make a Purchase

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

### 2. View Your Purchases

```bash
curl http://localhost:3000/api/checkout/my-purchases \
  -H "x-user-id: 1"
```

### 3. View Your Orders

```bash
curl http://localhost:3000/api/checkout/my-orders \
  -H "x-user-id: 1"
```

### 4. Get a Specific Purchase

```bash
curl http://localhost:3000/api/checkout/purchase/1 \
  -H "x-user-id: 1"
```

---

## Troubleshooting

### Issue: "Cannot find module 'express'"

**Solution:** Run `npm install` to install dependencies.

### Issue: "Database connection failed"

**Solution:**
1. Ensure MySQL is running
2. Verify credentials in `.env` file
3. Check database exists: `mysql -u root -p -e "SHOW DATABASES;"`

### Issue: "EADDRINUSE: address already in use :::3000"

**Solution:** Change PORT in `.env` or kill the process using port 3000:

```bash
# macOS/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Issue: "Supplier API connection timeout"

**Solution:**
1. Verify `SUPPLIER_API_URL` is correct
2. Verify `SUPPLIER_API_KEY` is valid
3. Check internet connection
4. Check supplier API is online

### Issue: "Insufficient balance" on purchase

**Solution:** Increase user balance in database:

```sql
UPDATE users SET balance = 1000 WHERE id = 1;
```

---

## Project Structure

```
smm-panel-server/
├── config/
│   └── database.js              # MySQL configuration
├── models/
│   ├── User.js                  # User model with password hashing
│   ├── Order.js                 # Order model
│   └── PurchasedLog.js          # Purchased logs model
├── services/
│   ├── supplierService.js       # Supplier API integration with Axios
│   └── pricingService.js        # Pricing calculations
├── routes/
│   └── checkout.js              # Checkout and purchase endpoints
├── database/
│   └── init.sql                 # Database schema
├── server.js                    # Express server entry point
├── package.json                 # Dependencies and scripts
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore rules
├── README.md                    # Project overview
└── API_DOCUMENTATION.md         # Complete API documentation
```

---

## Key Features

✅ **User Authentication** - x-user-id header authentication
✅ **MySQL Database** - Persistent data storage with connection pooling
✅ **Environment Variables** - Secure configuration management
✅ **Supplier API Integration** - Async Axios requests with error handling
✅ **Dynamic Pricing** - Customizable markup percentages
✅ **Balance Management** - Automatic deduction on purchase
✅ **Comprehensive Logging** - Environment-aware logging
✅ **Error Handling** - Proper HTTP status codes and error messages
✅ **Database Transactions** - Consistent state management
✅ **Security** - Password hashing, input validation, authorization checks

---

## Environment Variables Explained

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_HOST` | MySQL server hostname | `localhost` |
| `DB_USER` | MySQL username | `root` |
| `DB_PASSWORD` | MySQL password | `your_password` |
| `DB_NAME` | Database name | `smm_panel` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` or `production` |
| `SUPPLIER_API_URL` | Supplier API base URL | `https://api.supplier.com` |
| `SUPPLIER_API_KEY` | Supplier API key | `your_api_key` |
| `SUPPLIER_PRODUCT_ID` | Default product ID | `social_media_accounts` |

---

## Next Steps

1. **Add Authentication Routes** - Implement user registration and login
2. **Add Payment Processing** - Integrate payment gateways (Stripe, PayPal)
3. **Add Admin Dashboard** - Manage users, orders, and statistics
4. **Add Frontend** - React/Vue application for user interface
5. **Add Tests** - Unit and integration tests
6. **Deploy** - Deploy to production server

---

## Support

For issues or questions:
1. Check [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for endpoint details
2. Review error messages in console logs
3. Check database tables with MySQL client
4. Review environment variables in `.env` file

---

## License

MIT License - Feel free to use this project for your needs.
