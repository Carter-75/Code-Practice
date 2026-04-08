const { OpenAI } = require('openai');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const openai = new OpenAI({
  apiKey: (process.env.OPENAI_API_KEY || '').trim(),
});

/**
 * Sends a prompt to OpenAI and returns the response content.
 */
async function getChatCompletion(prompt) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw new Error(`AI Service Error: ${error.message}`);
  }
}

module.exports = {
  getChatCompletion,
};
