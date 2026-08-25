const crypto = require('crypto');
const razorpayInstance = require('../config/razorpay');
const { Order } = require('../models/Schemas');

/**
 * POST /api/razorpay/order
 * Creates a Razorpay order for an existing internal Order (or ad-hoc amount).
 */
const createRazorpayOrder = async (req, res) => {
  try {
    const { internalOrderId, amount, currency = 'INR', receipt } = req.body;

    let payableAmount = amount;
    let order = null;

    if (internalOrderId) {
      order = await Order.findById(internalOrderId);
      if (!order) {
        return res.status(404).json({ error: 'Internal order not found' });
      }
      payableAmount = order.totalAmount;
    }

    if (!payableAmount || payableAmount <= 0) {
      return res.status(400).json({ error: 'A valid amount or internalOrderId is required' });
    }

    const options = {
      amount: Math.round(payableAmount * 100), // Razorpay expects paise
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
      payment_capture: 1,
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);

    if (order) {
      order.razorpayOrderId = razorpayOrder.id;
      order.status = 'created';
      await order.save();
    }

    return res.status(201).json({
      success: true,
      razorpayOrder,
      keyId: process.env.RAZORPAY_KEY_ID,
      internalOrderId: order ? order._id.toString() : null,
    });
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    return res.status(500).json({ error: 'Failed to create Razorpay order', details: error.message });
  }
};

/**
 * POST /api/razorpay/verify
 * Verifies the payment signature returned by Razorpay Checkout using HMAC SHA256.
 */
const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      internalOrderId,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing Razorpay verification fields' });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      if (internalOrderId) {
        await Order.findByIdAndUpdate(internalOrderId, { status: 'failed' });
      }
      return res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }

    let updatedOrder = null;
    if (internalOrderId) {
      updatedOrder = await Order.findByIdAndUpdate(
        internalOrderId,
        {
          status: 'paid',
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
        },
        { new: true }
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      order: updatedOrder,
    });
  } catch (error) {
    console.error('Razorpay verification error:', error);
    return res.status(500).json({ error: 'Failed to verify payment', details: error.message });
  }
};

module.exports = { createRazorpayOrder, verifyRazorpayPayment };