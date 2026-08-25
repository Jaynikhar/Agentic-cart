const { groqClient, GROQ_MODEL } = require('../config/groq');
const { Product, Order } = require('../models/Schemas');
const { createPendingOrderFromItems } = require('../utils/orderUtils');

/* ---------- Server-side session memory ----------
   Keyed by sessionId, holds the FULL message array including
   tool calls and tool results — this is what the frontend can't
   safely carry, since tool payloads reference live DB IDs.
   In-memory Map is fine for a single-instance hackathon deploy;
   swap for Redis/Mongo if you ever run multiple backend instances. */
const sessionStore = new Map();
const MAX_SESSION_AGE_MS = 1000 * 60 * 60 * 2; // 2 hours

const getSession = (sessionId) => {
  const existing = sessionStore.get(sessionId);
  if (existing && Date.now() - existing.lastUsed < MAX_SESSION_AGE_MS) {
    existing.lastUsed = Date.now();
    return existing.messages;
  }
  const fresh = [{ role: 'system', content: SYSTEM_PROMPT }];
  sessionStore.set(sessionId, { messages: fresh, lastUsed: Date.now() });
  return fresh;
};

const saveSession = (sessionId, messages) => {
  sessionStore.set(sessionId, { messages, lastUsed: Date.now() });
};

/* ---------- Tool (function) definitions exposed to the LLM ---------- */
const tools = [
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Search the product catalog by keyword and/or category to find items matching what the user wants to buy.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Free-text search keywords, e.g. "wireless headphones"' },
          category: { type: 'string', description: 'Optional category filter' },
          maxPrice: { type: 'number', description: 'Optional maximum price in INR' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product_details',
      description: 'Fetch full details (price, stock, description) for a specific product by its MongoDB ObjectId.',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'The MongoDB ObjectId of the product' },
        },
        required: ['productId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_order',
      description:
        'Create a pending order once the user has confirmed they want to purchase specific items. Trigger this on ANY clear purchase-intent phrasing, however casually worded — "book it", "book all", "get me one", "I\'ll take it", "buy this", "order it", "yes", "confirm", etc. — as long as it is reasonably clear which item(s) from the recent conversation they mean. If the user says something like "book all" right after a search result was shown, treat it as confirming every item just listed. If it is genuinely ambiguous which item they mean, ask a quick clarifying question instead of calling this tool.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'List of items to purchase',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string' },
                quantity: { type: 'number' },
              },
              required: ['productId', 'quantity'],
            },
          },
        },
        required: ['items'],
      },
    },
  },
];

/* ---------- Tool implementations ---------- */
const executeTool = async (name, args, sessionId) => {
  switch (name) {
    case 'search_products': {
      const filter = { isActive: true };
      if (args.category) filter.category = new RegExp(args.category, 'i');
      if (typeof args.maxPrice === 'number') filter.price = { $lte: args.maxPrice };

      let products = [];
      try {
        if (args.query) {
          products = await Product.find(
            { ...filter, $text: { $search: args.query } },
            { score: { $meta: 'textScore' } }
          ).sort({ score: { $meta: 'textScore' } }).limit(8).lean();
        } else {
          products = await Product.find(filter).limit(8).lean();
        }
      } catch (textSearchError) {
        products = [];
      }

      if (products.length === 0 && args.query) {
        try {
          products = await Product.find({
            ...filter,
            $or: [
              { name: new RegExp(args.query, 'i') },
              { description: new RegExp(args.query, 'i') },
              { tags: new RegExp(args.query, 'i') },
            ],
          }).limit(8).lean();
        } catch (regexError) {
          products = [];
        }
      }

      if (products.length === 0) {
        return { noResults: true, message: 'No matching products found in the current catalog.' };
      }

      return products.map(p => ({
        id: p._id.toString(),
        name: p.name,
        price: p.price,
        stock: p.stock,
        category: p.category,
        description: p.description,
      }));
    }

    case 'get_product_details': {
      const product = await Product.findById(args.productId).lean();
      if (!product) return { error: 'Product not found' };
      return {
        id: product._id.toString(),
        name: product.name,
        price: product.price,
        stock: product.stock,
        category: product.category,
        description: product.description,
        rating: product.rating,
      };
    }

    case 'create_order': {
      const order = await createPendingOrderFromItems({
        items: args.items,
        sessionId,
        agentNotes: 'Order created by AI chat agent after user purchase confirmation.',
      });
      return {
        orderCreated: true,
        internalOrderId: order._id.toString(),
        totalAmount: order.totalAmount,
        currency: order.currency,
        items: order.items,
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
};

const SYSTEM_PROMPT = `You are the AgenticCart shopping assistant, an autonomous commerce agent for an e-commerce store.
- Help users discover products using the search_products and get_product_details tools.
- Be concise, friendly, and proactive about recommending relevant items.
- FORMATTING RULES (strict): This is a plain-text chat bubble, not a markdown renderer.
  - NEVER use markdown tables (no "|" pipe characters, no "---" separator rows).
  - NEVER use "**bold**" or "*italic*" syntax.
  - NEVER use markdown headers ("#", "##").
  - When listing multiple products, use simple line breaks with a dash, like:
    - Wireless Bluetooth Headphones — ₹2,499 (25 in stock)
    - Smart Fitness Watch — ₹4,999 (15 in stock)
  - Keep descriptions short and conversational, on the same or next line.
- UNDERSTANDING PURCHASE INTENT: Users will phrase confirmation casually and in many different ways —
  "book it", "book all", "book any one", "get me one", "buy this", "I'll take it", "order it", "yes",
  "confirm", "go ahead", etc. Treat all of these as real purchase confirmation, not just exact phrases
  like "yes, confirm the order". Use the recent conversation (including your own last search results)
  to figure out exactly which product(s) they mean:
  - "book all" after a search list → order every item just shown, quantity 1 each, unless stock is 0.
  - "book any one" / "get me one" after a search list → pick the first in-stock item from that list.
  - "book the second one" / "the headphones" → resolve to the specific matching item.
  - If you truly cannot tell which item they mean (e.g. no recent search happened), ask ONE short
    clarifying question instead of guessing randomly.
- Only skip create_order when there is genuine ambiguity — don't require a rigid confirmation phrase.
- After create_order succeeds, tell the user their order is ready and that payment checkout will now begin. Mention the internalOrderId.
- Always be transparent about prices and totals before or right after creating the order.`;

/**
 * POST /api/chat
 * Runs an OpenAI-compatible (Groq) function-calling loop, with full
 * conversation state (including tool calls) persisted server-side per session.
 */
const handleChat = async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({ error: 'message and sessionId are required' });
    }

    const messages = getSession(sessionId);
    messages.push({ role: 'user', content: message });


    let finalOrderPayload = null;
    const MAX_HISTORY_MESSAGES = 12;
    if (messages.length > MAX_HISTORY_MESSAGES + 1) {
      const systemMsg = messages[0];
      const recent = messages.slice(-MAX_HISTORY_MESSAGES);
      messages.splice(0, messages.length, systemMsg, ...recent);
    }
    
    const MAX_TURNS = 5;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      let completion;
      try {
        completion = await groqClient.chat.completions.create({
          model: GROQ_MODEL,
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0.3,
        });
      } catch (apiError) {
        // console.error('Groq API call failed:', apiError.message);
        console.error('Groq API call failed:', apiError.status, apiError.error || apiError.message);
        saveSession(sessionId, messages);
        return res.status(200).json({
          reply: "Sorry, I had trouble processing that. Could you rephrase or try again?",
          orderCreated: null,
          recoverable: true,
        });
      }

      const responseMessage = completion?.choices?.[0]?.message;

      if (!responseMessage) {
        saveSession(sessionId, messages);
        return res.status(200).json({
          reply: "I didn't quite catch that — could you try rephrasing?",
          orderCreated: finalOrderPayload,
          recoverable: true,
        });
      }

      messages.push(responseMessage);

      const toolCalls = responseMessage.tool_calls;

      if (!toolCalls || toolCalls.length === 0) {
        saveSession(sessionId, messages);
        return res.json({
          reply: responseMessage.content || "I'm here — what would you like to do?",
          orderCreated: finalOrderPayload,
        });
      }

      for (const toolCall of toolCalls) {
        const fnName = toolCall.function?.name;
        let fnArgs = {};
        try {
          fnArgs = JSON.parse(toolCall.function?.arguments || '{}');
        } catch (e) {
          fnArgs = {};
        }

        let result;
        try {
          result = await executeTool(fnName, fnArgs, sessionId);
          if (fnName === 'create_order' && result && result.orderCreated) {
            finalOrderPayload = result;
          }
        } catch (toolError) {
          console.error(`Tool "${fnName}" failed:`, toolError.message);
          result = { error: toolError.message || 'Tool execution failed' };
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }

    saveSession(sessionId, messages);
    return res.status(200).json({
      reply: "I've processed your request but need a bit more clarification — could you confirm what you'd like to do next?",
      orderCreated: finalOrderPayload,
      recoverable: true,
    });
  } catch (error) {
    console.error('Chat controller error:', error);
    return res.status(500).json({
      error: 'Failed to process chat message',
      details: error.message,
      recoverable: true,
    });
  }
};

module.exports = { handleChat };