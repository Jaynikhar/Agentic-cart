const mongoose = require('mongoose');
const { Schema } = mongoose;

/* -------------------- Product Schema -------------------- */
const ProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 }, // in INR (rupees, not paise)
    category: { type: String, required: true, index: true },
    stock: { type: Number, required: true, default: 0, min: 0 },
    imageUrl: { type: String, default: '' },
    tags: [{ type: String, trim: true, lowercase: true }],
    rating: { type: Number, default: 0, min: 0, max: 5 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });

/* -------------------- Order Schema -------------------- */
const OrderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: false },
    sessionId: { type: String, required: true, index: true }, // for guest/agentic chat sessions
    items: { type: [OrderItemSchema], required: true, validate: v => Array.isArray(v) && v.length > 0 },
    totalAmount: { type: Number, required: true, min: 0 }, // in INR
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['pending', 'created', 'paid', 'failed', 'cancelled'],
      default: 'pending',
    },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    shippingAddress: {
      line1: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: 'India' },
    },
    agentNotes: { type: String, default: '' }, // reasoning trail left by the AI agent
  },
  { timestamps: true }
);

/* -------------------- User Schema -------------------- */
const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    addresses: [
      {
        line1: String,
        city: String,
        state: String,
        pincode: String,
        country: { type: String, default: 'India' },
      },
    ],
    chatSessions: [{ type: String }], // sessionIds linked to this user
  },
  { timestamps: true }
);

const Product = mongoose.model('Product', ProductSchema);
const Order = mongoose.model('Order', OrderSchema);
const User = mongoose.model('User', UserSchema);

module.exports = { Product, Order, User };