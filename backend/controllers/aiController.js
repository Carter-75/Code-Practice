const path = require('path');
const fs = require('fs').promises;
const openaiService = require('../services/openai');

// Load the master knowledge base
const CONTEXT_PATH = path.join(__dirname, '../prompts/context.json');

async function getContext() {
  const data = await fs.readFile(CONTEXT_PATH, 'utf-8');
  return JSON.parse(data);
}

async function saveContext(context) {
  await fs.writeFile(CONTEXT_PATH, JSON.stringify(context, null, 2));
}

async function getPrompt(filename) {
  const filePath = path.join(__dirname, '../prompts', filename);
  return await fs.readFile(filePath, 'utf-8');
}

exports.generateNewQuestion = async (req, res) => {
  const difficulty = req.query.difficulty || 'medium';
  const selectedLangs = req.query.languages ? req.query.languages.split(',') : ['javascript', 'python', 'java'];

  try {
    const context = await getContext();
    const systemInstruction = await getPrompt('questionPrompt.txt');
    
    // Build a flat list of all allowed topics across selected languages
    let pool = [];
    selectedLangs.forEach(lang => {
      if (context.curriculum[lang]) {
        const domain = context.curriculum[lang];
        const filtered = domain.topics.filter(t => t.difficulty.toLowerCase() === difficulty.toLowerCase());
        filtered.forEach(topic => {
          pool.push({ ...topic, domain: lang });
        });
      }
    });
    
    if (pool.length === 0) {
      throw new Error(`No ${difficulty} topics found for selected categories: ${selectedLangs.join(', ')}`);
    }

    // Pick one random topic as the specific context for this generation
    const selectedTopic = pool[Math.floor(Math.random() * pool.length)];

    // Strict Modality Enforcement: Drawing is reserved for specific visual logic domains
    let modalityGuidance = "AVAILABLE MODALITIES: 'code', 'mcq', 'text'.";
    
    if (selectedTopic.domain.toLowerCase() === 'automata') {
        modalityGuidance = "AVAILABLE MODALITIES: 'drawing', 'code', 'mcq', 'text'. Drawing is allowed for state machines.";
    } else if (selectedTopic.domain.toLowerCase() === 'c_systems' && selectedTopic.title.toLowerCase().includes('memory')) {
        modalityGuidance = "AVAILABLE MODALITIES: 'drawing', 'code', 'mcq', 'text'. Drawing is allowed for stack/heap diagrams.";
    }
    
    // Final reminder on visual aids
    const visualAidInstruction = "REMINDER: DO NOT provide a dallePrompt unless you are providing a mandatory reference diagram for analysis. If the user can answer without seeing a picture, omit the dallePrompt.";

    const fullPrompt = `
      ${systemInstruction}
      
      ### THE CHALLENGE DATA
      DOMAIN: ${selectedTopic.domain.toUpperCase()}
      TOPIC: ${selectedTopic.title}
      DIFFICULTY: ${selectedTopic.difficulty}
      PROBLEM_KEY: ${selectedTopic.problem}
      EXPERT_SOLUTION: ${selectedTopic.snippet}
      TECHNICAL_RATIONALE: ${selectedTopic.rationale}
      
      ### TARGET MODALITY
      ${modalityGuidance}
      
      ### VISUAL AID POLICY
      ${visualAidInstruction}
      
      ### INSTRUCTION
      Your task is to transform the provided CHALLENGE DATA into a high-fidelity training challenge.
      DO NOT copy the PROBLEM_KEY verbatim; rephrase it into a professional academic task.
      ALWAYS include the TECHNICAL_RATIONALE in your explanation.
    `;

    const aiResponse = await openaiService.getChatCompletion(fullPrompt);
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : aiResponse;

    const result = JSON.parse(cleanJson);

    // DALL-E Integration: Only if necessary (explicit prompt from AI)
    if (result.dallePrompt) {
      try {
        const promptForIm = result.dallePrompt || `A simple, hand-drawn whiteboard diagram illustrating ${result.title} curriculum.`;
        const imageUrl = await openaiService.generateImage(promptForIm);
        result.imageUrl = imageUrl;
      } catch (imgError) {
        console.error('Image Generation Failed:', imgError);
      }
    }

    // Safeguard: Ensure problem is stringified if it comes back as object
    if (result.problem && typeof result.problem === 'object') {
      result.problem = JSON.stringify(result.problem, null, 2);
    }

    res.json(result);
  } catch (error) {
    console.error('Generation Error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.evaluateSolution = async (req, res) => {
  const { question, userCode, type } = req.body;

  try {
    const [systemInstruction, context, questionPrompt] = await Promise.all([
      getPrompt('evaluationPrompt.txt'),
      getContext(),
      getPrompt('questionPrompt.txt')
    ]);
    
    // Determine if we have a visual submission (drawing)
    const isImage = typeof userCode === 'string' && userCode.startsWith('data:image');

    const prompt = `
      ${systemInstruction}
      QUESTION TYPE: ${type || 'code'}
      CHALLENGE CONTEXT: ${questionPrompt}
      CURATED RULES: ${JSON.stringify(context.ai_rules)}
      THE SPECIFIC CHALLENGE: ${question}
      STUDENT SUBMISSION: ${isImage ? '[VISUAL SKETCH ATTACHED]' : userCode}
    `;

    const aiResponse = await openaiService.getChatCompletion(prompt, isImage ? userCode : null);
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : aiResponse;

    const result = JSON.parse(cleanJson);

    // DALL-E Integration for Evaluation Visuals
    if (result.dallePrompt) {
      try {
        const visualAidUrl = await openaiService.generateImage(result.dallePrompt);
        result.visualAidUrl = visualAidUrl;
      } catch (imgError) {
        console.error('Feedback Image Generation Failed:', imgError);
      }
    }

    // Persistence: Save the session data for later AI-assisted merging
    try {
      const EXTR_PATH = path.join(__dirname, '../prompts/extracted_patterns.json');
      let currentData = { extracted_lessons: [] };
      try {
        const fileContent = await fs.readFile(EXTR_PATH, 'utf-8');
        currentData = JSON.parse(fileContent);
      } catch (e) { /* ignore if file doesn't exist yet */ }
      
      if (!currentData.extracted_lessons) currentData.extracted_lessons = [];
      
      currentData.extracted_lessons.push({
         timestamp: new Date().toISOString(),
         type: 'resolved_session',
         question: question,
         user_submission: userCode,
         modality: type,
         feedback: result
      });
      await fs.writeFile(EXTR_PATH, JSON.stringify(currentData, null, 2));
    } catch (saveError) {
      console.error('Session Persistence Failed:', saveError);
    }

    res.json(result);
  } catch (error) {
    console.error('Evaluation Error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.skipQuestion = async (req, res) => {
  // Logic to track skipped questions can be added here
  res.json({ status: 'skipped' });
};

exports.submitFeedback = async (req, res) => {
  const { feedback, currentContext } = req.body;

  try {
    const context = await getContext();
    const reflectionInstruction = `
      YOU ARE THE EXPERT TUTOR REFLECTION ENGINE.
      THE USER HAS PROVIDED FEEDBACK ON YOUR PERFORMANCE OR THE DIFFICULTY.
      
      FEEDBACK: "${feedback}"
      CURRENT CONTEXT: ${JSON.stringify(context)}

      TASK:
      1. Analyze if the feedback requires a global rule change or a specific topic adjustment.
      2. Return the UPDATED context JSON object.
      3. Focus on "leniency", "difficulty spikes", or "incorrect patterns" as mentioned by the user.
      
      RETURN ONLY THE UPDATED JSON.
    `;

    const aiResponse = await openaiService.getChatCompletion(reflectionInstruction);
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const updatedContext = JSON.parse(jsonMatch[0]);
      await saveContext(updatedContext);
      res.json({ message: 'Feedback incorporated! My brain has evolved.', status: 'success' });
    } else {
      throw new Error('AI failed to generate valid context update.');
    }
  } catch (error) {
    console.error('Feedback Reflection Error:', error);
    res.status(500).json({ error: 'Failed to evolve from feedback.' });
  }
};

exports.getAvailableLanguages = async (req, res) => {
  try {
    const context = await getContext();
    const sortedLangs = Object.keys(context.curriculum).sort();
    res.json(sortedLangs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch languages' });
  }
};
