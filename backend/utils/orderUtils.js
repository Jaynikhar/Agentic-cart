const { Order, Product } = require('../models/Schemas');

/**
 * Builds and persists a "pending" Order document from a list of
 * { productId, quantity } items. Used by the chat agent's function-calling
 * loop once the user confirms purchase intent.
 */
const createPendingOrderFromItems = async ({ items, sessionId, userId = null, shippingAddress = null, agentNotes = '' }) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('No items provided to create an order.');
  }

  const resolvedItems = [];
  let totalAmount = 0;

  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product) {
      throw new Error(`Product not found: ${item.productId}`);
    }
    if (!product.isActive) {
      throw new Error(`Product is not available: ${product.name}`);
    }
    const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
    if (product.stock < quantity) {
      throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}`);
    }

    resolvedItems.push({
      product: product._id,
      name: product.name,
      quantity,
      price: product.price,
    });

    totalAmount += product.price * quantity;
  }

  const order = await Order.create({
    user: userId,
    sessionId,
    items: resolvedItems,
    totalAmount,
    status: 'pending',
    shippingAddress: shippingAddress || undefined,
    agentNotes,
  });

  return order;
};

module.exports = { createPendingOrderFromItems };