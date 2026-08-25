# 🛒 AgenticCart

**An AI shopping agent that doesn't just recommend products — it completes the purchase.**

Built for the **Razorpay Buildathon — Track 1: AI Growth & Agentic Commerce**.

AgenticCart lets users chat naturally with an AI agent to discover products, get details, and — once they explicitly confirm intent to buy — completes a real, verified purchase through Razorpay, without ever leaving the conversation.

---

## ✨ Features

- **Conversational product discovery** — search and explore a live product catalog through natural language
- **Real function-calling AI agent** — powered by Groq (OpenAI-SDK-compatible), with tools for searching products, fetching details, and creating orders
- **Explicit purchase confirmation gate** — the agent never creates an order until the user clearly confirms intent to buy
- **End-to-end Razorpay integration** — real order creation and payment checkout, with server-side HMAC SHA256 signature verification (not just trusting the frontend)
- **MongoDB-backed catalog** — supports catalogs from a handful of products to tens of thousands, with full-text search and regex fallback
- **Polished, modern UI** — glassmorphic chat interface built with React and Tailwind CSS

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Tailwind CSS, Axios |
| Backend | Node.js, Express (MVC structure) |
| Database | MongoDB with Mongoose |
| AI Agent | Groq API via the `openai` SDK (OpenAI-compatible endpoint) |
| Payments | Razorpay (Orders API + Checkout + HMAC SHA256 verification) |
| Deployment | Frontend on Vercel · Backend on Render · Database on MongoDB Atlas |

---

## 📁 Project Structure

```
agenticcart/
├── backend/
│   ├── config/
│   │   ├── db.js              # MongoDB connection
│   │   ├── razorpay.js        # Razorpay SDK instance
│   │   └── groq.js            # Groq client (OpenAI SDK, custom baseURL)
│   ├── controllers/
│   │   ├── chatController.js  # Agent function-calling loop
│   │   └── paymentController.js # Order creation + signature verification
│   ├── models/
│   │   └── Schemas.js         # Product, Order, User models
│   ├── routes/
│   │   └── api.js             # /api/chat, /api/razorpay/order, /api/razorpay/verify
│   ├── utils/
│   │   └── orderUtils.js      # Order-building helper used by the agent
│   ├── seed.js                # Small starter product seed
│   ├── seed-massive.js        # Generates a large synthetic catalog
│   ├── seed-dummyjson.js      # Imports real product data from DummyJSON
│   ├── server.js              # Express entry point
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── components/
    │   │   └── ChatWindow.js  # Chat UI, product cards, order card
    │   ├── App.js              # Chat state + Razorpay Checkout flow
    │   ├── api.js               # Axios client for backend calls
    │   ├── index.js
    │   └── index.css
    ├── tailwind.config.js
    ├── postcss.config.js
    └── package.json
```

---

## ⚙️ Setup & Local Development

### Prerequisites

- Node.js 18+
- A MongoDB connection string (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- A [Razorpay](https://dashboard.razorpay.com/app/keys) account (test mode keys)
- A [Groq API key](https://console.groq.com/keys)

### 1. Clone the repo

```bash
git clone https://github.com/<your-username>/agenticcart.git
cd agenticcart
```

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `backend/.env`:

```env
MONGO_URI=your_mongodb_connection_string
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=openai/gpt-oss-120b
PORT=5000
```

Seed the product catalog (pick one):

```bash
node seed.js              # small starter set
# or
node seed-dummyjson.js    # ~194 real products from DummyJSON
# or
node seed-massive.js      # 10,000 synthetic products across 10 categories
```

Start the backend:

```bash
npm run dev
```

Backend runs at `http://localhost:5000`.

### 3. Frontend setup

In a new terminal:

```bash
cd frontend
npm install
```

Optional — only needed if your backend isn't on `localhost:5000`:

```bash
echo "REACT_APP_API_URL=http://localhost:5000/api" > .env
```

Start the frontend:

```bash
npm start
```

Frontend runs at `http://localhost:3000`.

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Sends a user message through the AI agent's function-calling loop |
| `POST` | `/api/razorpay/order` | Creates a Razorpay order for a pending internal order |
| `POST` | `/api/razorpay/verify` | Verifies the payment signature via HMAC SHA256 and marks the order paid |

---

## 🧪 Testing a Payment

Use Razorpay's official [test card details](https://razorpay.com/docs/payments/payments/test-card-upi-details/):

```
Card Number: 4111 1111 1111 1111
Expiry: any future date
CVV: any 3 digits
```

---

## 🚀 Deployment

- **Frontend:** deployed on [Vercel](https://vercel.com) — root directory `frontend`, env var `REACT_APP_API_URL` pointing at the backend's `/api` path
- **Backend:** deployed on [Render](https://render.com) — root directory `backend`, all `.env` variables set in the Render dashboard
- **Database:** [MongoDB Atlas](https://www.mongodb.com/atlas)

---

## 🛡️ How Purchase Safety Works

The agent has three tools available: `search_products`, `get_product_details`, and `create_order`. The system prompt — enforced in the backend, not the UI — explicitly instructs the model to **never call `create_order` until the user has clearly and unambiguously confirmed** they want to buy specific items. Once an order is created, payment is only ever confirmed after the backend independently recomputes and verifies the Razorpay signature server-side, so a manipulated frontend response can never falsely mark an order as paid.

---

## 📄 License

Built for the Razorpay Buildathon — Track 1: AI Growth & Agentic Commerce.