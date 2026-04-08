const path = require('path');
const fs = require('fs').promises;
const openaiService = require('../services/openai');

async function getPrompt(filename) {
  const filePath = path.join(__dirname, '../prompts', filename);
  return await fs.readFile(filePath, 'utf-8');
}

exports.evaluateSolution = async (req, res) => {
  const { question, userCode } = req.body;

  try {
    const [systemInstruction, staticContext, questionPrompt] = await Promise.all([
      getPrompt('evaluationPrompt.txt'),
      getPrompt('context.txt'),
      getPrompt('questionPrompt.txt')
    ]);
    
    const prompt = `
      ${systemInstruction}
      CHALLENGE QUESTION CONTEXT: ${questionPrompt}
      CURATED CODE CONTEXT: ${staticContext}
      THE SPECIFIC CHALLENGE: ${question}
      STUDENT SUBMISSION: ${userCode}
    `;

    const aiResponse = await openaiService.getChatCompletion(prompt);
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : aiResponse;

    const result = JSON.parse(cleanJson);
    res.json(result);
  } catch (error) {
    console.error('Evaluation Error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.generateNewQuestion = async (req, res) => {
  const difficulty = req.query.difficulty || 'medium';

  try {
    const [systemInstruction, staticContext] = await Promise.all([
      getPrompt('questionPrompt.txt'),
      getPrompt('context.txt')
    ]);
    
    const fullPrompt = `
      ${systemInstruction}
      SELECTED DIFFICULTY LEVEL: ${difficulty.toUpperCase()}
      CURATED CONTEXT: ${staticContext}
    `;

    const aiResponse = await openaiService.getChatCompletion(fullPrompt);
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : aiResponse;

    const result = JSON.parse(cleanJson);

    // Safeguard: Ensure problem is a string
    if (result.problem && typeof result.problem === 'object') {
      result.problem = Object.entries(result.problem)
        .map(([key, val]) => `${key.toUpperCase()}:\n${val}`)
        .join('\n\n');
    }

    res.json(result);
  } catch (error) {
    console.error('Generation Error:', error);
    res.status(500).json({ error: error.message });
  }
};
