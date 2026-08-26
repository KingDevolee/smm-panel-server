#!/bin/bash
# SMM Panel Server - cURL Examples
# 
# This file contains cURL commands for testing the SMM Panel API
# Run these commands from your terminal to test endpoints
#
# Requirements:
# - Server running on http://localhost:3000
# - User ID 1 exists in database with sufficient balance
# - Replace x-user-id header with your actual user ID

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   SMM PANEL API - cURL EXAMPLES        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}\n"

# ============================================
# 1. HEALTH CHECK
# ============================================

echo -e "${GREEN}1. CHECK SERVER HEALTH${NC}"
echo "Command: curl http://localhost:3000/health"
echo "Expected: Server status and timestamp"
echo ""
curl -s http://localhost:3000/health | jq '.'
echo -e "\n---\n"

# ============================================
# 2. TEST DATABASE CONNECTION
# ============================================

echo -e "${GREEN}2. TEST DATABASE CONNECTION${NC}"
echo "Command: curl http://localhost:3000/test-db"
echo "Expected: Database connection confirmation"
echo ""
curl -s http://localhost:3000/test-db | jq '.'
echo -e "\n---\n"

# ============================================
# 3. PURCHASE ACCOUNTS (Checkout)
# ============================================

echo -e "${GREEN}3. PURCHASE ACCOUNTS (POST /api/checkout)${NC}"
echo "Command: Purchase 5 accounts with \$10 base price and 30% markup"
echo "Calculation: 5 × (\$10 × 1.30) = \$65 total"
echo ""
curl -s -X POST http://localhost:3000/api/checkout \
  -H "x-user-id: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 5,
    "basePrice": 10,
    "markupPercentage": 30
  }' | jq '.'
echo -e "\n---\n"

# ============================================
# 4. PURCHASE WITH DIFFERENT MARKUP
# ============================================

echo -e "${GREEN}4. PURCHASE WITH DIFFERENT MARKUP${NC}"
echo "Command: Purchase 3 accounts with 45% markup"
echo "Calculation: 3 × (\$10 × 1.45) = \$43.50 total"
echo ""
curl -s -X POST http://localhost:3000/api/checkout \
  -H "x-user-id: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 3,
    "basePrice": 10,
    "markupPercentage": 45
  }' | jq '.'
echo -e "\n---\n"

# ============================================
# 5. GET USER'S PURCHASES
# ============================================

echo -e "${GREEN}5. GET ALL USER PURCHASES (GET /api/checkout/my-purchases)${NC}"
echo "Command: curl http://localhost:3000/api/checkout/my-purchases -H \"x-user-id: 1\""
echo "Expected: List of all purchased logs"
echo ""
curl -s -X GET http://localhost:3000/api/checkout/my-purchases \
  -H "x-user-id: 1" \
  -H "Content-Type: application/json" | jq '.'
echo -e "\n---\n"

# ============================================
# 6. GET USER'S ORDERS
# ============================================

echo -e "${GREEN}6. GET ALL USER ORDERS (GET /api/checkout/my-orders)${NC}"
echo "Command: curl http://localhost:3000/api/checkout/my-orders -H \"x-user-id: 1\""
echo "Expected: List of all orders"
echo ""
curl -s -X GET http://localhost:3000/api/checkout/my-orders \
  -H "x-user-id: 1" \
  -H "Content-Type: application/json" | jq '.'
echo -e "\n---\n"

# ============================================
# 7. GET SPECIFIC PURCHASE
# ============================================

echo -e "${GREEN}7. GET SPECIFIC PURCHASE (GET /api/checkout/purchase/:logId)${NC}"
echo "Command: Get purchase with ID 1"
echo ""
curl -s -X GET http://localhost:3000/api/checkout/purchase/1 \
  -H "x-user-id: 1" \
  -H "Content-Type: application/json" | jq '.'
echo -e "\n---\n"

# ============================================
# 8. ERROR HANDLING - MISSING USER ID
# ============================================

echo -e "${GREEN}8. ERROR TEST - MISSING AUTHENTICATION${NC}"
echo "Command: Purchase without x-user-id header"
echo "Expected: 401 Unauthorized error"
echo ""
curl -s -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 5,
    "basePrice": 10,
    "markupPercentage": 30
  }' | jq '.'
echo -e "\n---\n"

# ============================================
# 9. ERROR HANDLING - INVALID QUANTITY
# ============================================

echo -e "${GREEN}9. ERROR TEST - INVALID QUANTITY${NC}"
echo "Command: Purchase with negative quantity"
echo "Expected: 400 Bad Request error"
echo ""
curl -s -X POST http://localhost:3000/api/checkout \
  -H "x-user-id: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": -5,
    "basePrice": 10,
    "markupPercentage": 30
  }' | jq '.'
echo -e "\n---\n"

# ============================================
# 10. ERROR HANDLING - INSUFFICIENT BALANCE
# ============================================

echo -e "${GREEN}10. ERROR TEST - INSUFFICIENT BALANCE${NC}"
echo "Command: Purchase with large quantity (likely to exceed balance)"
echo "Expected: 402 Payment Required error"
echo ""
curl -s -X POST http://localhost:3000/api/checkout \
  -H "x-user-id: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 1000,
    "basePrice": 100,
    "markupPercentage": 50
  }' | jq '.'
echo -e "\n---\n"

# ============================================
# 11. ERROR HANDLING - INVALID LOG ID
# ============================================

echo -e "${GREEN}11. ERROR TEST - INVALID LOG ID${NC}"
echo "Command: Get purchase with non-existent ID"
echo "Expected: 404 Not Found error"
echo ""
curl -s -X GET http://localhost:3000/api/checkout/purchase/99999 \
  -H "x-user-id: 1" \
  -H "Content-Type: application/json" | jq '.'
echo -e "\n---\n"

# ============================================
# 12. ERROR HANDLING - UNAUTHORIZED ACCESS
# ============================================

echo -e "${GREEN}12. ERROR TEST - UNAUTHORIZED ACCESS${NC}"
echo "Command: Try to access another user's purchase (with different user ID)"
echo "Expected: 403 Forbidden error"
echo ""
curl -s -X GET http://localhost:3000/api/checkout/purchase/1 \
  -H "x-user-id: 999" \
  -H "Content-Type: application/json" | jq '.'
echo -e "\n---\n"

# ============================================
# 13. ADVANCED - PURCHASE WITH CUSTOM PRODUCT ID
# ============================================

echo -e "${GREEN}13. ADVANCED - PURCHASE WITH CUSTOM PRODUCT ID${NC}"
echo "Command: Purchase with specific product ID"
echo ""
curl -s -X POST http://localhost:3000/api/checkout \
  -H "x-user-id: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 2,
    "productId": "instagram_verified",
    "basePrice": 20,
    "markupPercentage": 40
  }' | jq '.'
echo -e "\n---\n"

# ============================================
# ADDITIONAL TESTING NOTES
# ============================================

echo -e "${BLUE}═════════════════════════════════════════${NC}"
echo -e "${BLUE}ADDITIONAL TESTING NOTES${NC}"
echo -e "${BLUE}═════════════════════════════════════════${NC}\n"

echo "1. Replace 'x-user-id: 1' with your actual user ID"
echo ""
echo "2. Ensure server is running:"
echo "   npm run dev"
echo ""
echo "3. Check database is initialized:"
echo "   mysql -u root -p < database/init.sql"
echo ""
echo "4. Verify .env file is configured correctly:"
echo "   cp .env.example .env"
echo ""
echo "5. Test one endpoint at a time to see full response:"
echo "   curl -s http://localhost:3000/health | jq '.'"
echo ""
echo "6. For POST requests with complex data, use -d flag:"
echo "   curl -X POST http://localhost:3000/api/checkout \\"
echo "     -H 'x-user-id: 1' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"quantity\": 5, \"basePrice\": 10}'"
echo ""
echo "7. Save response to file:"
echo "   curl http://localhost:3000/api/checkout/my-purchases \\"
echo "     -H 'x-user-id: 1' > response.json"
echo ""
echo "8. Get only HTTP status code:"
echo "   curl -o /dev/null -s -w '%{http_code}' http://localhost:3000/health"
echo ""
echo "9. Get response headers:"
echo "   curl -i http://localhost:3000/health"
echo ""
echo "10. Make request with custom headers:"
echo "    curl -H 'x-user-id: 1' \\"
echo "         -H 'Authorization: Bearer TOKEN' \\"
echo "         http://localhost:3000/api/checkout/my-purchases"
echo -e "\n"
