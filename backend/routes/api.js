const express = require('express');
const router = express.Router();

const { handleChat } = require('../controllers/chatController');
const { createRazorpayOrder, verifyRazorpayPayment } = require('../controllers/paymentController');

// AI Agent chat endpoint (Groq function-calling loop)
router.post('/chat', handleChat);

// Razorpay order + verification endpoints
router.post('/razorpay/order', createRazorpayOrder);
router.post('/razorpay/verify', verifyRazorpayPayment);

module.exports = router;