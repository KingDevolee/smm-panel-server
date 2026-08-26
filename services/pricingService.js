/**
 * Price calculation and management service for SMM Panel
 * Handles markup calculations, profit margins, and pricing strategies
 */

/**
 * Calculate retail price with profit markup
 * Takes supplier base price and applies a percentage markup
 *
 * @param {number} basePrice - Base price from supplier API
 * @param {number} markupPercentage - Profit markup percentage (e.g., 30 for 30%)
 * @returns {number} - Final retail price with markup applied
 * @throws {Error} - Throws error if inputs are invalid
 *
 * @example
 * // Calculate price with 30% markup
 * const retailPrice = calculateRetailPrice(10, 30);
 * console.log(retailPrice); // Output: 13
 *
 * @example
 * // Calculate price with custom markup
 * const retailPrice = calculateRetailPrice(50, 45);
 * console.log(retailPrice); // Output: 72.5
 */
function calculateRetailPrice(basePrice, markupPercentage = 30) {
  // Validate basePrice
  if (basePrice === null || basePrice === undefined) {
    throw new Error('Base price is required');
  }

  if (typeof basePrice !== 'number' || basePrice < 0) {
    throw new Error('Base price must be a non-negative number');
  }

  // Validate markupPercentage
  if (markupPercentage === null || markupPercentage === undefined) {
    throw new Error('Markup percentage is required');
  }

  if (typeof markupPercentage !== 'number' || markupPercentage < 0) {
    throw new Error('Markup percentage must be a non-negative number');
  }

  // Calculate markup amount
  const markupAmount = (basePrice * markupPercentage) / 100;

  // Calculate final retail price
  const retailPrice = basePrice + markupAmount;

  // Round to 2 decimal places for currency
  return Math.round(retailPrice * 100) / 100;
}

/**
 * Calculate profit amount from base price and retail price
 *
 * @param {number} basePrice - Base price from supplier
 * @param {number} retailPrice - Final retail price
 * @returns {number} - Profit amount
 * @throws {Error} - Throws error if inputs are invalid
 *
 * @example
 * const profit = calculateProfit(10, 13);
 * console.log(profit); // Output: 3
 */
function calculateProfit(basePrice, retailPrice) {
  if (typeof basePrice !== 'number' || basePrice < 0) {
    throw new Error('Base price must be a non-negative number');
  }

  if (typeof retailPrice !== 'number' || retailPrice < 0) {
    throw new Error('Retail price must be a non-negative number');
  }

  if (retailPrice < basePrice) {
    throw new Error('Retail price cannot be less than base price');
  }

  const profit = retailPrice - basePrice;
  return Math.round(profit * 100) / 100;
}

/**
 * Calculate profit percentage (ROI)
 *
 * @param {number} basePrice - Base price from supplier
 * @param {number} retailPrice - Final retail price
 * @returns {number} - Profit percentage
 * @throws {Error} - Throws error if inputs are invalid
 *
 * @example
 * const profitPercent = calculateProfitPercentage(10, 13);
 * console.log(profitPercent); // Output: 30
 */
function calculateProfitPercentage(basePrice, retailPrice) {
  if (typeof basePrice !== 'number' || basePrice <= 0) {
    throw new Error('Base price must be a positive number');
  }

  if (typeof retailPrice !== 'number' || retailPrice < 0) {
    throw new Error('Retail price must be a non-negative number');
  }

  if (retailPrice < basePrice) {
    throw new Error('Retail price cannot be less than base price');
  }

  const profitPercentage = ((retailPrice - basePrice) / basePrice) * 100;
  return Math.round(profitPercentage * 100) / 100;
}

/**
 * Apply different markup percentages based on product category or type
 *
 * @param {number} basePrice - Base price from supplier
 * @param {string} productType - Type of product (e.g., 'instagram', 'twitter', 'facebook')
 * @returns {number} - Final retail price with category-based markup
 * @throws {Error} - Throws error if inputs are invalid
 *
 * @example
 * const price = calculateRetailPriceByCategory(10, 'instagram');
 * console.log(price); // Output: 13 (30% markup for Instagram)
 *
 * @example
 * const price = calculateRetailPriceByCategory(15, 'tiktok');
 * console.log(price); // Output: 19.5 (30% markup for TikTok)
 */
function calculateRetailPriceByCategory(basePrice, productType = 'default') {
  // Validate basePrice
  if (typeof basePrice !== 'number' || basePrice < 0) {
    throw new Error('Base price must be a non-negative number');
  }

  // Markup percentages by product type
  const markupByCategory = {
    instagram: 30,
    facebook: 25,
    twitter: 28,
    tiktok: 30,
    youtube: 35,
    linkedin: 40,
    telegram: 25,
    default: 30
  };

  // Get markup percentage for category, default to 30%
  const markupPercentage = markupByCategory[productType.toLowerCase()] || markupByCategory.default;

  return calculateRetailPrice(basePrice, markupPercentage);
}

/**
 * Calculate bulk pricing with tiered discounts
 * Offers lower per-unit prices for bulk orders
 *
 * @param {number} basePrice - Base price per unit from supplier
 * @param {number} quantity - Number of units to order
 * @param {number} markupPercentage - Base markup percentage
 * @returns {Object} - Object containing unitPrice, totalPrice, bulkDiscount
 * @throws {Error} - Throws error if inputs are invalid
 *
 * @example
 * const pricing = calculateBulkPrice(10, 50, 30);
 * console.log(pricing);
 * // Output: { unitPrice: 12.22, totalPrice: 611, bulkDiscount: 5 }
 */
function calculateBulkPrice(basePrice, quantity, markupPercentage = 30) {
  // Validate inputs
  if (typeof basePrice !== 'number' || basePrice < 0) {
    throw new Error('Base price must be a non-negative number');
  }

  if (typeof quantity !== 'number' || quantity <= 0 || !Number.isInteger(quantity)) {
    throw new Error('Quantity must be a positive integer');
  }

  if (typeof markupPercentage !== 'number' || markupPercentage < 0) {
    throw new Error('Markup percentage must be a non-negative number');
  }

  // Calculate base unit price with markup
  const unitPrice = calculateRetailPrice(basePrice, markupPercentage);

  // Apply bulk discount tiers
  let bulkDiscount = 0;

  if (quantity >= 100) {
    bulkDiscount = 15; // 15% discount for 100+ units
  } else if (quantity >= 50) {
    bulkDiscount = 10; // 10% discount for 50+ units
  } else if (quantity >= 20) {
    bulkDiscount = 5; // 5% discount for 20+ units
  }

  // Calculate discounted unit price
  const discountedUnitPrice = unitPrice * (1 - bulkDiscount / 100);
  const finalUnitPrice = Math.round(discountedUnitPrice * 100) / 100;

  // Calculate total price
  const totalPrice = Math.round(finalUnitPrice * quantity * 100) / 100;

  return {
    unitPrice: Math.round(unitPrice * 100) / 100,
    discountedUnitPrice: finalUnitPrice,
    bulkDiscountPercentage: bulkDiscount,
    quantity: quantity,
    totalPrice: totalPrice,
    savings: Math.round((unitPrice * quantity - totalPrice) * 100) / 100
  };
}

/**
 * Apply promotional discount or coupon to retail price
 *
 * @param {number} retailPrice - Current retail price
 * @param {number} discountAmount - Discount amount (can be percentage or fixed)
 * @param {string} discountType - Type of discount ('percentage' or 'fixed')
 * @returns {number} - Final price after discount
 * @throws {Error} - Throws error if inputs are invalid
 *
 * @example
 * // Apply 10% discount
 * const finalPrice = applyDiscount(13, 10, 'percentage');
 * console.log(finalPrice); // Output: 11.7
 *
 * @example
 * // Apply fixed $2 discount
 * const finalPrice = applyDiscount(13, 2, 'fixed');
 * console.log(finalPrice); // Output: 11
 */
function applyDiscount(retailPrice, discountAmount, discountType = 'percentage') {
  // Validate retailPrice
  if (typeof retailPrice !== 'number' || retailPrice < 0) {
    throw new Error('Retail price must be a non-negative number');
  }

  // Validate discountAmount
  if (typeof discountAmount !== 'number' || discountAmount < 0) {
    throw new Error('Discount amount must be a non-negative number');
  }

  // Validate discountType
  const validTypes = ['percentage', 'fixed'];
  if (!validTypes.includes(discountType.toLowerCase())) {
    throw new Error(`Discount type must be 'percentage' or 'fixed'`);
  }

  let finalPrice = retailPrice;

  if (discountType.toLowerCase() === 'percentage') {
    if (discountAmount > 100) {
      throw new Error('Percentage discount cannot exceed 100%');
    }
    finalPrice = retailPrice * (1 - discountAmount / 100);
  } else if (discountType.toLowerCase() === 'fixed') {
    finalPrice = retailPrice - discountAmount;
    if (finalPrice < 0) {
      throw new Error('Discount amount exceeds retail price');
    }
  }

  return Math.round(finalPrice * 100) / 100;
}

/**
 * Format price for display with currency symbol
 *
 * @param {number} price - Price to format
 * @param {string} currencyCode - Currency code (e.g., 'USD', 'EUR', 'GBP')
 * @returns {string} - Formatted price string
 * @throws {Error} - Throws error if price is invalid
 *
 * @example
 * const formatted = formatPrice(13.50, 'USD');
 * console.log(formatted); // Output: "$13.50"
 *
 * @example
 * const formatted = formatPrice(13.50, 'EUR');
 * console.log(formatted); // Output: "€13.50"
 */
function formatPrice(price, currencyCode = 'USD') {
  // Validate price
  if (typeof price !== 'number' || price < 0) {
    throw new Error('Price must be a non-negative number');
  }

  // Currency symbols
  const currencySymbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    CHF: 'CHF',
    CNY: '¥',
    INR: '₹',
    MXN: '$',
    NZD: 'NZ$'
  };

  const symbol = currencySymbols[currencyCode.toUpperCase()] || currencyCode;

  // Format price to 2 decimal places
  const formattedPrice = price.toFixed(2);

  return `${symbol}${formattedPrice}`;
}

/**
 * Comprehensive pricing breakdown for display
 *
 * @param {number} basePrice - Base price from supplier
 * @param {number} markupPercentage - Profit markup percentage
 * @param {string} currencyCode - Currency code for formatting
 * @returns {Object} - Complete pricing information
 * @throws {Error} - Throws error if inputs are invalid
 *
 * @example
 * const breakdown = getPricingBreakdown(10, 30, 'USD');
 * console.log(breakdown);
 * // Output: {
 * //   basePrice: 10,
 * //   markupPercentage: 30,
 * //   markupAmount: 3,
 * //   retailPrice: 13,
 * //   profitAmount: 3,
 * //   profitPercentage: 30,
 * //   displayPrice: '$13.00'
 * // }
 */
function getPricingBreakdown(basePrice, markupPercentage = 30, currencyCode = 'USD') {
  // Validate inputs
  if (typeof basePrice !== 'number' || basePrice < 0) {
    throw new Error('Base price must be a non-negative number');
  }

  if (typeof markupPercentage !== 'number' || markupPercentage < 0) {
    throw new Error('Markup percentage must be a non-negative number');
  }

  const retailPrice = calculateRetailPrice(basePrice, markupPercentage);
  const profitAmount = calculateProfit(basePrice, retailPrice);
  const profitPercentage = calculateProfitPercentage(basePrice, retailPrice);
  const markupAmount = Math.round((basePrice * markupPercentage) / 100 * 100) / 100;
  const displayPrice = formatPrice(retailPrice, currencyCode);

  return {
    basePrice: Math.round(basePrice * 100) / 100,
    markupPercentage: markupPercentage,
    markupAmount: markupAmount,
    retailPrice: retailPrice,
    profitAmount: profitAmount,
    profitPercentage: profitPercentage,
    currencyCode: currencyCode,
    displayPrice: displayPrice
  };
}

module.exports = {
  calculateRetailPrice,
  calculateProfit,
  calculateProfitPercentage,
  calculateRetailPriceByCategory,
  calculateBulkPrice,
  applyDiscount,
  formatPrice,
  getPricingBreakdown
};
