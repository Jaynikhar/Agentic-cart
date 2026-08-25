// AgenticCart uses the official `openai` SDK (v4+) as the agent framework,
// but points it at Groq's OpenAI-compatible endpoint.
// NO OpenAI API key is used anywhere in this project — GROQ_API_KEY only.
const OpenAI = require('openai');

if (!process.env.GROQ_API_KEY) {
  console.warn('⚠️  GROQ_API_KEY is not set in .env — chat agent routes will fail.');
}

const groqClient = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

module.exports = { groqClient, GROQ_MODEL };