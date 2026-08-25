require('dotenv').config();
const mongoose = require('mongoose');
const { Product } = require('./models/Schemas');

const CATEGORY_DATA = {
  Electronics: {
    nouns: ['Headphones', 'Smartwatch', 'Bluetooth Speaker', 'Laptop', 'Tablet', 'Power Bank', 'Wireless Mouse', 'Keyboard', 'Webcam', 'Smart TV', 'Earbuds', 'Router', 'External SSD', 'Gaming Console', 'Drone'],
    priceRange: [499, 89999],
  },
  Footwear: {
    nouns: ['Running Shoes', 'Sneakers', 'Sandals', 'Formal Shoes', 'Sports Shoes', 'Loafers', 'Boots', 'Slip-Ons', 'Flip Flops', 'Trekking Shoes'],
    priceRange: [399, 8999],
  },
  Fashion: {
    nouns: ['T-Shirt', 'Jeans', 'Jacket', 'Kurta', 'Dress', 'Hoodie', 'Formal Shirt', 'Saree', 'Shorts', 'Sweater', 'Blazer', 'Track Pants'],
    priceRange: [299, 4999],
  },
  'Home & Kitchen': {
    nouns: ['Coffee Maker', 'Mixer Grinder', 'Non-Stick Pan Set', 'Bedsheet Set', 'Table Lamp', 'Water Bottle', 'Storage Containers', 'Curtains', 'Wall Clock', 'Cushion Covers', 'Air Fryer', 'Induction Cooktop'],
    priceRange: [199, 12999],
  },
  Beauty: {
    nouns: ['Face Serum', 'Moisturizer', 'Sunscreen', 'Lipstick', 'Perfume', 'Hair Dryer', 'Shampoo', 'Face Wash', 'Trimmer', 'Nail Polish Set'],
    priceRange: [149, 3499],
  },
  Sports: {
    nouns: ['Yoga Mat', 'Dumbbells Set', 'Cricket Bat', 'Football', 'Badminton Racket', 'Cycling Helmet', 'Resistance Bands', 'Skipping Rope', 'Gym Bag', 'Water Bottle Sipper'],
    priceRange: [199, 7999],
  },
  Books: {
    nouns: ['Novel', 'Self-Help Book', 'Cookbook', 'Biography', 'Fiction Collection', 'Comic Book', 'Textbook', 'Poetry Collection', 'Business Book', 'Kids Storybook'],
    priceRange: [99, 1499],
  },
  Toys: {
    nouns: ['Building Blocks Set', 'Remote Control Car', 'Puzzle', 'Action Figure', 'Board Game', 'Soft Toy', 'Doll House', 'Art Kit', 'Educational Kit', 'Drone Toy'],
    priceRange: [199, 4999],
  },
  Grocery: {
    nouns: ['Basmati Rice Pack', 'Cooking Oil', 'Green Tea Box', 'Dry Fruits Pack', 'Organic Honey', 'Protein Powder', 'Cereal Box', 'Spice Combo Pack', 'Coffee Beans Pack', 'Snacks Combo'],
    priceRange: [99, 2499],
  },
  Furniture: {
    nouns: ['Office Chair', 'Study Table', 'Bookshelf', 'Sofa Set', 'Bed Frame', 'Wardrobe', 'Dining Table', 'Recliner', 'TV Unit', 'Shoe Rack'],
    priceRange: [1499, 49999],
  },
};

const BRANDS = ['Zenith', 'Nova', 'Urban', 'Prime', 'Apex', 'Bolt', 'Lumen', 'Vertex', 'Orbit', 'Crest', 'Pulse', 'Nimbus', 'Anchor', 'Drift', 'Halo'];
const ADJECTIVES = ['Pro', 'Max', 'Plus', 'Lite', 'Elite', 'Classic', 'Ultra', 'Prime', 'Essential', 'Advanced', 'Compact', 'Deluxe'];

const categories = Object.keys(CATEGORY_DATA);

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[randInt(0, arr.length - 1)];

const generateProducts = (count) => {
  const products = [];
  for (let i = 0; i < count; i++) {
    const category = categories[i % categories.length];
    const { nouns, priceRange } = CATEGORY_DATA[category];
    const noun = pick(nouns);
    const brand = pick(BRANDS);
    const adjective = pick(ADJECTIVES);
    const modelNumber = randInt(100, 999);

    const name = `${brand} ${noun} ${adjective} ${modelNumber}`;
    const price = randInt(priceRange[0], priceRange[1]);
    const stock = randInt(0, 200);

    products.push({
      name,
      description: `${brand} presents the ${noun} ${adjective}, a top pick in ${category.toLowerCase()} known for reliable quality and everyday value. Model ${modelNumber}.`,
      price,
      category,
      stock,
      imageUrl: '',
      tags: [category.toLowerCase(), noun.toLowerCase().split(' ')[0], brand.toLowerCase()],
      rating: parseFloat((Math.random() * 2 + 3).toFixed(1)), // 3.0 - 5.0
      isActive: true,
    });
  }
  return products;
};

const TOTAL_PRODUCTS = 10000;
const BATCH_SIZE = 1000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB. Clearing existing products...');
    await Product.deleteMany({});

    console.log(`Generating and inserting ${TOTAL_PRODUCTS} products in batches of ${BATCH_SIZE}...`);
    for (let inserted = 0; inserted < TOTAL_PRODUCTS; inserted += BATCH_SIZE) {
      const batchCount = Math.min(BATCH_SIZE, TOTAL_PRODUCTS - inserted);
      const batch = generateProducts(batchCount);
      await Product.insertMany(batch, { ordered: false });
      console.log(`Inserted ${inserted + batchCount} / ${TOTAL_PRODUCTS}`);
    }

    await Product.syncIndexes();
    console.log('✅ Done. Text indexes synced.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  });