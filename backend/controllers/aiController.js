const path = require('path');
const fs = require('fs').promises;
const openaiService = require('../services/openai');

// Robust Path Resolution for Vercel & Local Monorepos
const getSafePath = (relativePath) => {
  const base = process.cwd();
  
  // 1. Vercel Write Path Redirect
  if (process.env.VERCEL && (relativePath.includes('extracted_patterns') || relativePath.includes('evolution_rules'))) {
    return path.join('/tmp', path.basename(relativePath));
  }

  // 2. Try Absolute from CWD (Standard)
  const primaryPath = path.join(base, relativePath);
  
  // 3. Try Monorepo Subfolder mapping (If CWD is the Repo Root)
  if (!relativePath.startsWith('backend/')) {
    const backupPath = path.join(base, 'backend', relativePath);
    // Note: We'll decide which one to use at runtime via a probe in getContext
    return { primaryPath, backupPath };
  }
  
  return { primaryPath };
};

const PATHS = {
  context: getSafePath('prompts/context.json'),
  evolution: getSafePath('prompts/evolution_rules.json'),
  extracted: getSafePath('prompts/extracted_patterns.json')
};

async function readFileSafe(paths) {
  try {
    return await fs.readFile(paths.primaryPath, 'utf-8');
  } catch (e) {
    if (paths.backupPath) {
      try {
        return await fs.readFile(paths.backupPath, 'utf-8');
      } catch (e2) {
        throw new Error(`File not found at ${paths.primaryPath} OR ${paths.backupPath}`);
      }
    }
    throw new Error(`File not found at ${paths.primaryPath}`);
  }
}

async function getContext() {
  const data = await readFileSafe(PATHS.context);
  return JSON.parse(data);
}

async function saveContext(context) {
  const savePath = PATHS.context.primaryPath;
  await fs.writeFile(savePath, JSON.stringify(context, null, 2));
}

async function getEvolutionRules() {
  try {
    const data = await readFileSafe(PATHS.evolution);
    return JSON.parse(data);
  } catch (e) {
    return { rules: [] };
  }
}

async function saveEvolutionRules(rules) {
  const savePath = PATHS.evolution.primaryPath;
  await fs.writeFile(savePath, JSON.stringify(rules, null, 2));
}

async function getPrompt(filename) {
  const paths = getSafePath(path.join('prompts', filename));
  return await readFileSafe(paths);
}

// Utility to check for API key
const checkApiKey = (res) => {
  if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY is missing from the Environment Vault!');
    res.status(500).json({
      error: 'Vault Error: OpenAI API Key is missing from Vercel Environment Variables.'
    });
    return false;
  }
  return true;
};

exports.generateNewQuestion = async (req, res) => {
  if (!checkApiKey(res)) return;
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

    // Load evolution rules
    const evolutionData = await getEvolutionRules();

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
      
      ### SYSTEM CONTEXT & RULES
      CURATED RULES: ${JSON.stringify(context.ai_rules)}
      ADAPTIVE EVOLUTION RULES: ${JSON.stringify(evolutionData.rules)}
      
      ### INSTRUCTION
      Your task is to transform the provided CHALLENGE DATA into a high-fidelity training challenge.
      DO NOT copy the PROBLEM_KEY verbatim; rephrase it into a professional academic task.
      ALWAYS include the TECHNICAL_RATIONALE in your explanation.
      STRICTLY ADHERE to the CURATED RULES and ADAPTIVE EVOLUTION RULES.
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
    const [systemInstruction, context, questionPrompt, evolutionData] = await Promise.all([
      getPrompt('evaluationPrompt.txt'),
      getContext(),
      getPrompt('questionPrompt.txt'),
      getEvolutionRules()
    ]);

    // Determine if we have a visual submission (drawing)
    const isImage = typeof userCode === 'string' && userCode.startsWith('data:image');

    const prompt = `
      ${systemInstruction}
      QUESTION TYPE: ${type || 'code'}
      CHALLENGE CONTEXT: ${questionPrompt}
      CURATED RULES: ${JSON.stringify(context.ai_rules)}
      ADAPTIVE EVOLUTION RULES: ${JSON.stringify(evolutionData.rules)}
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

      const savePath = PATHS.extracted.primaryPath;
      let currentData = { extracted_lessons: [] };
      try {
        const fileContent = await readFileSafe(PATHS.extracted);
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
      await fs.writeFile(savePath, JSON.stringify(currentData, null, 2));
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
  const { feedback } = req.body;

  try {
    const paths = getSafePath('prompts');
    // For readdir, we'll try primary first
    let dirToRead = paths.primaryPath;
    try {
      await fs.access(dirToRead);
    } catch (e) {
      dirToRead = paths.backupPath;
    }

    const files = await fs.readdir(dirToRead);

    // Read all txt and json files for holistic context as requested
    const allContextData = await Promise.all(
      files.filter(f => f.endsWith('.txt') || f.endsWith('.json')).map(async f => {
        const fullPaths = getSafePath(path.join('prompts', f));
        const content = await readFileSafe(fullPaths);
        return `FILE: ${f}\nCONTENT:\n${content}\n---`;
      })
    );

    // Fetch last session for specific evaluation context
    let lastSession = "No recent session data available.";
    try {
      const EXTR_PATH = path.join(__dirname, '../prompts/extracted_patterns.json');
      const fileContent = await fs.readFile(EXTR_PATH, 'utf-8');
      const data = JSON.parse(fileContent);
      if (data.extracted_lessons && data.extracted_lessons.length > 0) {
        lastSession = JSON.stringify(data.extracted_lessons[data.extracted_lessons.length - 1]);
      }
    } catch (e) { /* ignore */ }

    const reflectionInstruction = `
      YOU ARE THE EXPERT TUTOR SELF-EVOLUTION ENGINE.
      
      THE USER HAS PROVIDED CRITIQUE/FEEDBACK ON YOUR RECENT PERFORMANCE.
      USER FEEDBACK: "${feedback}"
      
      CONTEXT OF LAST SESSION:
      ${lastSession}

      GLOBAL SYSTEM CONTEXT (All prompts and rules):
      ${allContextData.join('\n\n')}

      TASK:
      1. Analyze the feedback in the context of ALL existing rules and prompts.
      2. Determine if a behavioral shift is needed (e.g., "be more lenient on syntax", "focus more on security during evaluation").
      3. Generate a SINGLE, CONCISE system adjustment rule (max 2 sentences).
      4. Return a JSON object with a single key "new_rule".
      
      RETURN ONLY THE JSON.
    `;

    const aiResponse = await openaiService.getChatCompletion(reflectionInstruction);
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      const newRule = result.new_rule;

      // Update evolution_rules.json instead of context.json
      const evolutionData = await getEvolutionRules();
      if (!evolutionData.rules) evolutionData.rules = [];

      evolutionData.rules.push({
        timestamp: new Date().toISOString(),
        feedback_received: feedback,
        evolution_rule: newRule
      });

      // Keep last 10 rules
      if (evolutionData.rules.length > 10) evolutionData.rules.shift();

      await saveEvolutionRules(evolutionData);
      res.json({ message: newRule, status: 'success' });
    } else {
      throw new Error('AI failed to generate a refinement rule.');
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

    // Force 200 response by disabling cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json(sortedLangs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch languages' });
  }
};
