require('dotenv').config();
const mongoose = require('mongoose');
const { Product } = require('./models/Schemas');

const products = [
  { name: 'Wireless Bluetooth Headphones', description: 'Over-ear noise-cancelling headphones with 30hr battery', price: 2499, category: 'Electronics', stock: 25, tags: ['audio', 'wireless', 'headphones'] },
  { name: 'Running Shoes Pro', description: 'Lightweight breathable running shoes', price: 3499, category: 'Footwear', stock: 40, tags: ['shoes', 'running', 'sports'] },
  { name: '15-inch Laptop Sleeve', description: 'Padded protective laptop sleeve', price: 899, category: 'Accessories', stock: 60, tags: ['laptop', 'bag', 'accessory'] },
  { name: 'Smart Fitness Watch', description: 'Heart-rate, sleep tracking, 7-day battery', price: 4999, category: 'Electronics', stock: 15, tags: ['watch', 'fitness', 'wearable'] },
  { name: 'Ceramic Coffee Mug Set', description: 'Set of 2 handcrafted ceramic mugs', price: 599, category: 'Home', stock: 100, tags: ['mug', 'gift', 'kitchen'] },
];

mongoose.connect(process.env.MONGO_URI).then(async () => {
  await Product.deleteMany({});
  await Product.insertMany(products);
  console.log('Seeded', products.length, 'products');
  process.exit(0);
}).catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});