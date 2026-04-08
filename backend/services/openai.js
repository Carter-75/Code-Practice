const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Sends a prompt to OpenAI and returns the response content.
 * @param {string} prompt 
 * @returns {Promise<string>}
 */
async function getChatCompletion(prompt) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using gpt-4o for high quality reasoning
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw new Error('Failed to communicate with AI service.');
  }
}

module.exports = {
  getChatCompletion,
};
