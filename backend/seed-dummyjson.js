require('dotenv').config();
const mongoose = require('mongoose');
const { Product } = require('./models/Schemas');

const USD_TO_INR = 83; // approximate conversion for demo purposes

const fetchDummyProducts = async () => {
  const res = await fetch('https://dummyjson.com/products?limit=194');
  if (!res.ok) {
    throw new Error(`DummyJSON request failed with status ${res.status}`);
  }
  const data = await res.json();
  return data.products;
};

const mapToProductSchema = (item) => ({
  name: item.title,
  description: item.description || `${item.title} — ${item.brand || 'Generic'} product in the ${item.category} category.`,
  price: Math.round(item.price * USD_TO_INR),
  category: item.category
    ? item.category.charAt(0).toUpperCase() + item.category.slice(1).replace(/-/g, ' ')
    : 'General',
  stock: item.stock ?? 50,
  imageUrl: (item.images && item.images[0]) || item.thumbnail || '',
  tags: item.tags && item.tags.length ? item.tags : [item.category || 'general'],
  rating: item.rating ? parseFloat(item.rating.toFixed(1)) : 4.0,
  isActive: true,
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB. Fetching products from DummyJSON...');
    const dummyProducts = await fetchDummyProducts();
    console.log(`Fetched ${dummyProducts.length} products. Clearing existing catalog...`);

    await Product.deleteMany({});

    const mapped = dummyProducts.map(mapToProductSchema);
    await Product.insertMany(mapped, { ordered: false });

    await Product.syncIndexes();
    console.log(`✅ Inserted ${mapped.length} products from DummyJSON. Text indexes synced.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  });