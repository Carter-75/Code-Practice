const { OpenAI } = require('openai');

function getOpenAIClient() {
  require('dotenv').config({ path: require('path').join(process.cwd(), '.env') });
  if (!process.env.OPENAI_API_KEY) {
    require('dotenv').config({ path: require('path').join(process.cwd(), 'backend', '.env') });
  }
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('CRITICAL: OPENAI_API_KEY is not defined in the environment.');
  }

  return new OpenAI({
    apiKey: (process.env.OPENAI_API_KEY || '').trim(),
  });
}

/**
 * Sends a prompt to OpenAI and returns the response content.
 * Supports multi-modal inputs (text + images).
 */
async function getChatCompletion(prompt, imageUrl = null) {
  try {
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
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw new Error(`AI Service Error: ${error.message}`);
  }
}

/**
 * Generates an image using DALL-E 3 and returns the URL.
 */
async function generateImage(prompt) {
  try {
    const client = getOpenAIClient();
    const response = await client.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
    });
    return response.data[0].url;
  } catch (error) {
    console.error('DALL-E API Error:', error);
    throw new Error(`Visual Service Error: ${error.message}`);
  }
}

module.exports = {
  getChatCompletion,
  generateImage,
};
