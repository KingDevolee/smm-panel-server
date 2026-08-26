const pool = require('../config/database');

class Order {
  /**
   * Create a new order
   * @param {number} userId - User ID
   * @param {string} productId - Supplier product ID
   * @param {number} quantity - Quantity ordered
   * @param {number} totalPrice - Total price paid
   * @param {string} status - Order status
   * @returns {Promise<Object>}
   */
  static async create(userId, productId, quantity, totalPrice, status = 'pending') {
    try {
      const connection = await pool.getConnection();
      
      const query = `
        INSERT INTO orders (user_id, supplier_product_id, quantity, total_price, status)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      const [result] = await connection.execute(query, [
        userId,
        productId,
        quantity,
        totalPrice,
        status
      ]);
      
      connection.release();
      
      return {
        id: result.insertId,
        userId,
        productId,
        quantity,
        totalPrice,
        status,
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to create order: ${error.message}`);
    }
  }

  /**
   * Find order by ID
   * @param {number} id - Order ID
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    try {
      const connection = await pool.getConnection();
      
      const query = `
        SELECT id, user_id, supplier_product_id, quantity, total_price, status, created_at
        FROM orders
        WHERE id = ?
      `;
      
      const [rows] = await connection.execute(query, [id]);
      connection.release();
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      throw new Error(`Failed to find order: ${error.message}`);
    }
  }

  /**
   * Find orders by user ID
   * @param {number} userId - User ID
   * @returns {Promise<Array>}
   */
  static async findByUserId(userId) {
    try {
      const connection = await pool.getConnection();
      
      const query = `
        SELECT id, user_id, supplier_product_id, quantity, total_price, status, created_at
        FROM orders
        WHERE user_id = ?
        ORDER BY created_at DESC
      `;
      
      const [rows] = await connection.execute(query, [userId]);
      connection.release();
      
      return rows;
    } catch (error) {
      throw new Error(`Failed to find orders: ${error.message}`);
    }
  }

  /**
   * Update order status
   * @param {number} id - Order ID
   * @param {string} status - New status
   * @returns {Promise<Object>}
   */
  static async updateStatus(id, status) {
    try {
      const connection = await pool.getConnection();
      
      const query = 'UPDATE orders SET status = ? WHERE id = ?';
      await connection.execute(query, [status, id]);
      connection.release();
      
      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to update order status: ${error.message}`);
    }
  }

  /**
   * Delete order
   * @param {number} id - Order ID
   * @returns {Promise<boolean>}
   */
  static async delete(id) {
    try {
      const connection = await pool.getConnection();
      
      const query = 'DELETE FROM orders WHERE id = ?';
      const [result] = await connection.execute(query, [id]);
      connection.release();
      
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Failed to delete order: ${error.message}`);
    }
  }
}

module.exports = Order;
