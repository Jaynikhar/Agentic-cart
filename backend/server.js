require('dotenv').config();

process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught Exception (server kept alive):', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('🔥 Unhandled Promise Rejection (server kept alive):', reason);
});


const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const connectDB = require('./config/db');
const { Product } = require('./models/Schemas');


const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB().then(async () => {
  try {
    await Product.syncIndexes();
    console.log('✅ Product indexes synced');
  } catch (err) {
    console.error('⚠️ Index sync failed:', err.message);
  }
});

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'https://agentic-cart-eight.vercel.app/', // replace with your actual Vercel URL
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
}));
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'AgenticCart Backend', model: process.env.GROQ_MODEL });
});

// Mount API routes
app.use('/api', apiRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 AgenticCart backend running on port ${PORT}`);
});