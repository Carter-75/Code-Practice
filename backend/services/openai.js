const { OpenAI } = require('openai');

// The API key is loaded once by backend/app.js (dotenv, repo-root .env.local)
// or from the hosting platform's environment variables. This service never
// reads env files itself and never exposes provider error details to callers:
// controller code maps failures to honest, generic messages.
function isConfigured() {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
}

function getOpenAIClient() {
  if (!isConfigured()) {
    const err = new Error('OpenAI API key is not configured on the server.');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY.trim(),
    timeout: 60000,
    maxRetries: 1,
  });
}

/**
 * Sends a prompt to OpenAI and returns the response content.
 * Supports multi-modal inputs (text + images).
 */
async function getChatCompletion(prompt, imageUrl = null) {
  const content = [{ type: "text", text: prompt }];

  if (imageUrl) {
    content.push({
      type: "image_url",
      image_url: { url: imageUrl },
    });
  }

  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: content }],
    temperature: 0.7,
  });
  return response.choices[0].message.content;
}

/**
 * Generates an image using DALL-E 3 and returns the URL.
 */
async function generateImage(prompt) {
  const client = getOpenAIClient();
  const response = await client.images.generate({
    model: "dall-e-3",
    prompt: prompt,
    n: 1,
    size: "1024x1024",
  });
  return response.data[0].url;
}

module.exports = {
  isConfigured,
  getChatCompletion,
  generateImage,
};
