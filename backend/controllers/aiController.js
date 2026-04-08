const path = require('path');
const fs = require('fs').promises;
const openaiService = require('../services/openai');

/**
 * Utility to read prompt files.
 */
async function getPrompt(filename) {
  const filePath = path.join(__dirname, '../prompts', filename);
  return await fs.readFile(filePath, 'utf-8');
}

/**
 * Controller to handle AI-based code evaluation.
 */
exports.evaluateSolution = async (req, res) => {
  const { question, userCode, contextCode } = req.body;

  if (!question || !userCode) {
    return res.status(400).json({ error: 'Question and code are required.' });
  }

  try {
    const systemInstruction = await getPrompt('evaluationPrompt.txt');
    
    const prompt = `
      ${systemInstruction}

      CHALLENGE:
      ${question}

      ${contextCode ? `CONTEXT CODE / BACKGROUND:\n${contextCode}` : ''}

      STUDENT SUBMISSION:
      ${userCode}
    `;

    const aiResponse = await openaiService.getChatCompletion(prompt);
    const cleanJson = aiResponse.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleanJson);
    res.json(result);
  } catch (error) {
    console.error('Controller Error:', error);
    res.status(500).json({ error: 'Failed to evaluate code.' });
  }
};

/**
 * Controller to generate a new practice question.
 */
exports.generateNewQuestion = async (req, res) => {
  const difficulty = req.query.difficulty || 'medium';

  try {
    const [systemInstruction, contextFile] = await Promise.all([
      getPrompt('questionPrompt.txt'),
      getPrompt('context.txt')
    ]);
    
    const fullPrompt = `
      ${systemInstruction}

      SELECTED DIFFICULTY LEVEL: ${difficulty.toUpperCase()}

      CONTEXT REFERENCE:
      ${contextFile}
    `;

    const aiResponse = await openaiService.getChatCompletion(fullPrompt);
    const cleanJson = aiResponse.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleanJson);
    res.json(result);
  } catch (error) {
    console.error('Controller Error:', error);
    res.status(500).json({ error: 'Failed to generate question.' });
  }
};
