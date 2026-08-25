const { groqClient, GROQ_MODEL } = require('../config/groq');
const { Product, Order } = require('../models/Schemas');
const { createPendingOrderFromItems } = require('../utils/orderUtils');

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
        'Create a pending order once the user has explicitly confirmed they want to purchase specific items and quantities. Do NOT call this unless the user has clearly confirmed intent to buy.',
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
        // Fallback if the text index is missing or the query has no valid terms
        products = [];
      }

      // Fallback to a plain regex search if $text found nothing
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
        return { noResults: true, message: 'The product you are looking for is currently unavailable.Try after few days.' };
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
        agentNotes: 'Order created by AI chat agent after explicit user confirmation.',
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
- NEVER call create_order until the user has explicitly and unambiguously confirmed they want to purchase specific items and quantities (e.g. "yes, buy it", "place the order", "confirm").
- If the user is just browsing or asking questions, do not create an order.
- After create_order succeeds, tell the user their order is ready and that payment checkout will now begin. Mention the internalOrderId.
- If search_products returns noResults, tell the user politely that item isn't in the catalog right now and suggest what IS available instead.
- Always be transparent about prices and totals before asking for purchase confirmation.`;

/**
 * POST /api/chat
 * Runs an OpenAI-compatible (Groq) function-calling loop.
 */
const handleChat = async (req, res) => {
  try {
    const { message, sessionId, history } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({ error: 'message and sessionId are required' });
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(Array.isArray(history) ? history : []),
      { role: 'user', content: message },
    ];

    let finalOrderPayload = null;
    const MAX_TURNS = 5;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      let completion;
      try {
        completion = await groqClient.chat.completions.create({
          model: GROQ_MODEL,
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0.4,
        });
      } catch (apiError) {
        console.error('Groq API call failed:', apiError.message);
        return res.status(200).json({
          reply: "Sorry, You typed something incorrectly. Could you please refresh and try again?",
          orderCreated: null,
          history: messages.filter(m => m.role !== 'system'),
          recoverable: true,
        });
      }

      const responseMessage = completion?.choices?.[0]?.message;

      if (!responseMessage) {
        return res.status(200).json({
          reply: "I didn't quite catch that — could you try rephrasing?",
          orderCreated: finalOrderPayload,
          history: messages.filter(m => m.role !== 'system'),
          recoverable: true,
        });
      }

      messages.push(responseMessage);

      const toolCalls = responseMessage.tool_calls;

      if (!toolCalls || toolCalls.length === 0) {
        return res.json({
          reply: responseMessage.content || "I'm here — what would you like to do?",
          orderCreated: finalOrderPayload,
          history: messages.filter(m => m.role !== 'system'),
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

    return res.status(200).json({
      reply: "I've processed your request but need a bit more clarification — could you confirm what you'd like to do next?",
      orderCreated: finalOrderPayload,
      history: messages.filter(m => m.role !== 'system'),
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