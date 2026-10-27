const path = require('path');
const fs = require('fs').promises;
const openaiService = require('../services/openai');

// Robust Path Resolution for Vercel & Local Monorepos
// Explicit Path Resolver: Finds the ONE true path for the current environment
const getSafePath = (relativePath) => {
  const base = process.cwd();
  const isVercel = process.env.VERCEL === '1' || process.env.PRODUCTION === 'true';
  const isWritable = relativePath.includes('extracted_patterns') || relativePath.includes('evolution_rules');

  // 1. Production Writable Redirect: the deployed filesystem is read-only,
  // so runtime-written files live in /tmp (ephemeral per instance).
  if (isVercel && isWritable) {
    return path.join('/tmp', path.basename(relativePath));
  }

  // 2. Probing all candidates to find the Single Truth
  const candidates = [
    path.join(base, relativePath),
    path.join(base, 'backend', relativePath),
    path.join(__dirname, '..', relativePath),
    path.resolve(relativePath)
  ];

  for (const candidate of candidates) {
    try {
      const fsSync = require('fs');
      if (fsSync.existsSync(candidate)) {
        return candidate;
      }
    } catch (e) { /* continue */ }
  }

  // Fallback to primary if nothing found (will throw explicit error on read)
  return candidates[0];
};

async function readFileSafe(targetPath) {
  try {
    return await fs.readFile(targetPath, 'utf-8');
  } catch (e) {
    if (targetPath.startsWith('/tmp')) return null;
    throw new Error(`FATAL: Resource Missing at Resolved Path: [${targetPath}]. Environmental Root: ${process.cwd()}`);
  }
}

const PATHS = {
  context: getSafePath('prompts/context.json'),
  evolution: getSafePath('prompts/evolution_rules.json'),
  extracted: getSafePath('prompts/extracted_patterns.json')
};

async function getContext() {
  const data = await readFileSafe(PATHS.context);
  return JSON.parse(data);
}

async function getEvolutionRules() {
  try {
    const data = await readFileSafe(PATHS.evolution);
    if (!data) return { rules: [] };
    return JSON.parse(data);
  } catch (e) {
    return { rules: [] };
  }
}

async function saveEvolutionRules(rules) {
  await fs.writeFile(PATHS.evolution, JSON.stringify(rules, null, 2));
}

async function getPrompt(filename) {
  const targetPath = getSafePath(path.join('prompts', filename));
  return await readFileSafe(targetPath);
}

// The AI features need a server-side OpenAI key. When it is missing or the
// provider rejects it, the API answers honestly instead of forwarding raw
// provider errors (which can contain key fragments and account links).
const AI_UNAVAILABLE = 'AI features are unavailable right now: the server OpenAI key is missing or was rejected. Everything else on the site still works. Set a valid OPENAI_API_KEY in the backend environment to restore AI questions and grading.';
const AI_FAILED = 'The AI service could not complete that request. Please try again.';
const AI_BAD_RESPONSE = 'The AI returned an unreadable response. Please try again.';

function aiErrorStatus(err) {
  if (err && err.code === 'AI_NOT_CONFIGURED') return 503;
  if (err && (err.status === 401 || err.status === 403)) return 503;
  return 502;
}

function sendAiError(res, err, contextLabel) {
  console.error(`${contextLabel}:`, err && err.message ? err.message : err);
  const status = aiErrorStatus(err);
  res.status(status).json({ error: status === 503 ? AI_UNAVAILABLE : AI_FAILED });
}

function requireAiConfigured(res) {
  if (!openaiService.isConfigured()) {
    res.status(503).json({ error: AI_UNAVAILABLE });
    return false;
  }
  return true;
}

function parseAiJson(aiResponse) {
  const jsonMatch = aiResponse && aiResponse.match(/\{[\s\S]*\}/);
  const cleanJson = jsonMatch ? jsonMatch[0] : aiResponse;
  return JSON.parse(cleanJson);
}

const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];

exports.generateNewQuestion = async (req, res) => {
  if (!requireAiConfigured(res)) return;
  const difficulty = String(req.query.difficulty || 'medium').toLowerCase();
  if (!VALID_DIFFICULTIES.includes(difficulty)) {
    return res.status(400).json({ error: `Invalid difficulty. Use one of: ${VALID_DIFFICULTIES.join(', ')}.` });
  }

  try {
    const context = await getContext();
    const knownLangs = Object.keys(context.curriculum);
    let selectedLangs = req.query.languages ? req.query.languages.split(',').map(s => s.trim()).filter(Boolean) : ['javascript', 'python', 'java'];
    const invalid = selectedLangs.filter(l => !knownLangs.includes(l));
    if (invalid.length > 0) {
      return res.status(400).json({ error: `Unknown topic(s): ${invalid.join(', ')}. Available topics: ${knownLangs.join(', ')}.` });
    }
    if (selectedLangs.length === 0) selectedLangs = ['javascript', 'python', 'java'];

    const systemInstruction = await getPrompt('questionPrompt.txt');

    // Build a flat list of all allowed topics across selected languages
    let pool = [];
    selectedLangs.forEach(lang => {
      const domain = context.curriculum[lang];
      const filtered = domain.topics.filter(t => t.difficulty.toLowerCase() === difficulty);
      filtered.forEach(topic => {
        pool.push({ ...topic, domain: lang });
      });
    });

    if (pool.length === 0) {
      return res.status(404).json({ error: `No ${difficulty} topics found for selected categories: ${selectedLangs.join(', ')}` });
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

      ### PRIVATE CALIBRATION REFERENCE (DO NOT ECHO ANY OF THIS TO THE STUDENT)
      DOMAIN: ${selectedTopic.domain.toUpperCase()}
      TOPIC SKILL: ${selectedTopic.title}
      DIFFICULTY TIER: ${selectedTopic.difficulty}
      REFERENCE_PROBLEM (PRIVATE - DO NOT REUSE OR REPHRASE): ${selectedTopic.problem}
      REFERENCE_SNIPPET (PRIVATE - DO NOT REUSE AS SOLUTION): ${selectedTopic.snippet}
      UNDERLYING_PRINCIPLE: ${selectedTopic.rationale}

      ### TARGET MODALITY
      ${modalityGuidance}

      ### VISUAL AID POLICY
      ${visualAidInstruction}

      ### SYSTEM CONTEXT & RULES
      CURATED RULES: ${JSON.stringify(context.ai_rules)}
      ADAPTIVE EVOLUTION RULES: ${JSON.stringify(evolutionData.rules)}

      ### YOUR MISSION
      Using the PRIVATE CALIBRATION REFERENCE above as a skill-level anchor ONLY:
      1. Understand the UNDERLYING_PRINCIPLE being tested.
      2. Invent a COMPLETELY ORIGINAL problem with a different scenario, different variable names, different data structures, and a different application context.
      3. The new problem must test the SAME underlying skill at the SAME difficulty tier.
      4. Choose whichever question TYPE (code/mcq/text/drawing) you believe is MOST EFFECTIVE for teaching this concept.
      5. DO NOT echo the reference problem, snippet, or rationale in your output.
      6. STRICTLY ADHERE to the CURATED RULES and ADAPTIVE EVOLUTION RULES.
    `;

    const aiResponse = await openaiService.getChatCompletion(fullPrompt);
    let result;
    try {
      result = parseAiJson(aiResponse);
    } catch (e) {
      console.error('Generation JSON parse failed');
      return res.status(502).json({ error: AI_BAD_RESPONSE });
    }

    // DALL-E Integration: Only if necessary (explicit prompt from AI)
    if (result.dallePrompt) {
      try {
        const imageUrl = await openaiService.generateImage(result.dallePrompt);
        result.imageUrl = imageUrl;
      } catch (imgError) {
        console.error('Image Generation Failed:', imgError && imgError.message ? imgError.message : imgError);
      }
    }

    // Safeguard: Ensure problem is stringified if it comes back as object
    if (result.problem && typeof result.problem === 'object') {
      result.problem = JSON.stringify(result.problem, null, 2);
    }

    // Never ship the answer key to the browser: the generated solution and
    // its explanation would let anyone read the correct answer before
    // submitting. Grading re-derives correctness on the server instead.
    delete result.solution;
    delete result.explanation;
    delete result.dallePrompt;

    res.json(result);
  } catch (error) {
    sendAiError(res, error, 'Generation Error');
  }
};

exports.evaluateSolution = async (req, res) => {
  if (!requireAiConfigured(res)) return;
  const { question, userCode, type, options, title } = req.body || {};

  if (typeof question !== 'string' || question.trim() === '') {
    return res.status(400).json({ error: 'A question is required to evaluate a submission.' });
  }
  if (typeof userCode !== 'string' || userCode.trim() === '') {
    return res.status(400).json({ error: 'A submission is required. Answer the question before requesting a review.' });
  }
  if (type === 'mcq' && (!Array.isArray(options) || options.length === 0)) {
    return res.status(400).json({ error: 'MCQ submissions must include the answer options so the selected index can be graded.' });
  }

  try {
    const [systemInstruction, context, questionPrompt, evolutionData] = await Promise.all([
      getPrompt('evaluationPrompt.txt'),
      getContext(),
      getPrompt('questionPrompt.txt'),
      getEvolutionRules()
    ]);

    // Determine if we have a visual submission (drawing)
    const isImage = userCode.startsWith('data:image');

    const visualAidInstruction = "REMINDER: DO NOT provide a dallePrompt unless you are providing a mandatory reference diagram for analysis. If no technical diagram is strictly necessary for the explanation, omit the dallePrompt entirely. Decorative/abstract images are strictly forbidden.";

    const optionsBlock = type === 'mcq'
      ? `\n      ANSWER OPTIONS (the student submission is the index of the chosen option): ${JSON.stringify(options)}`
      : '';

    const prompt = `
      ${systemInstruction}
      QUESTION TYPE: ${type || 'code'}
      QUESTION TITLE: ${typeof title === 'string' ? title : ''}
      CHALLENGE CONTEXT: ${questionPrompt}
      CURATED RULES: ${JSON.stringify(context.ai_rules)}
      ADAPTIVE EVOLUTION RULES: ${JSON.stringify(evolutionData.rules)}
      VISUAL AID POLICY: ${visualAidInstruction}
      THE SPECIFIC CHALLENGE: ${question}${optionsBlock}
      STUDENT SUBMISSION: ${isImage ? '[VISUAL SKETCH ATTACHED]' : userCode}
    `;

    const aiResponse = await openaiService.getChatCompletion(prompt, isImage ? userCode : null);
    let result;
    try {
      result = parseAiJson(aiResponse);
    } catch (e) {
      console.error('Evaluation JSON parse failed');
      return res.status(502).json({ error: AI_BAD_RESPONSE });
    }

    // DALL-E Integration for Evaluation Visuals
    if (result.dallePrompt) {
      try {
        const visualAidUrl = await openaiService.generateImage(result.dallePrompt);
        result.visualAidUrl = visualAidUrl;
      } catch (imgError) {
        console.error('Feedback Image Generation Failed:', imgError && imgError.message ? imgError.message : imgError);
      }
      delete result.dallePrompt;
    }

    try {
      const savePath = PATHS.extracted;
      let currentData = { extracted_lessons: [] };
      try {
        const fileContent = await readFileSafe(PATHS.extracted);
        if (fileContent) currentData = JSON.parse(fileContent);
      } catch (e) { /* ignore if file doesn't exist yet */ }

      if (!currentData.extracted_lessons) currentData.extracted_lessons = [];

      currentData.extracted_lessons.push({
        timestamp: new Date().toISOString(),
        type: 'resolved_session',
        question: question,
        // Never persist raw drawing uploads (multi-megabyte data URLs)
        user_submission: isImage ? '[VISUAL SKETCH]' : userCode,
        modality: type,
        feedback: result
      });
      await fs.writeFile(savePath, JSON.stringify(currentData, null, 2));
    } catch (saveError) {
      console.error('Session Persistence Failed:', saveError);
    }

    res.json(result);
  } catch (error) {
    sendAiError(res, error, 'Evaluation Error');
  }
};

exports.submitFeedback = async (req, res) => {
  if (!requireAiConfigured(res)) return;
  const { feedback } = req.body || {};
  if (typeof feedback !== 'string' || feedback.trim() === '') {
    return res.status(400).json({ error: 'Feedback text is required.' });
  }
  if (feedback.length > 2000) {
    return res.status(400).json({ error: 'Feedback is too long (2000 characters max).' });
  }

  try {
    const dirToRead = getSafePath('prompts');
    const files = await fs.readdir(dirToRead);

    // Read all txt and json files for holistic context as requested
    const allContextData = await Promise.all(
      files.filter(f => f.endsWith('.txt') || f.endsWith('.json')).map(async f => {
        const fullPaths = getSafePath(path.join('prompts', f));
        const content = await readFileSafe(fullPaths);
        return `FILE: ${f}\nCONTENT:\n${content}\n---`;
      })
    );

    // Fetch last session for specific evaluation context. Read through the
    // same resolved path used for writes: on the deployed (read-only)
    // filesystem that is the /tmp copy, not the bundled original.
    let lastSession = "No recent session data available.";
    try {
      const fileContent = await readFileSafe(PATHS.extracted);
      if (fileContent) {
        const data = JSON.parse(fileContent);
        if (data.extracted_lessons && data.extracted_lessons.length > 0) {
          lastSession = JSON.stringify(data.extracted_lessons[data.extracted_lessons.length - 1]);
        }
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
      4. Paraphrase the user's original feedback into a short, clear summary (max 1 sentence).
      5. Return a JSON object with two keys: "new_rule" and "paraphrased_feedback".

      RETURN ONLY THE JSON.
    `;

    const aiResponse = await openaiService.getChatCompletion(reflectionInstruction);
    let result;
    try {
      result = parseAiJson(aiResponse);
    } catch (e) {
      return res.status(502).json({ error: AI_BAD_RESPONSE });
    }

    const newRule = result.new_rule;
    const paraphrasedFeedback = result.paraphrased_feedback || feedback;
    if (!newRule) {
      return res.status(502).json({ error: AI_BAD_RESPONSE });
    }

    // Update evolution_rules.json instead of context.json
    const evolutionData = await getEvolutionRules();
    if (!evolutionData.rules) evolutionData.rules = [];

    evolutionData.rules.push({
      timestamp: new Date().toISOString(),
      feedback_received: paraphrasedFeedback,
      evolution_rule: newRule
    });

    // Keep last 10 rules
    if (evolutionData.rules.length > 10) evolutionData.rules.shift();

    await saveEvolutionRules(evolutionData);
    res.json({ message: newRule, status: 'success' });
  } catch (error) {
    sendAiError(res, error, 'Feedback Reflection Error');
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
    console.error('Languages Error:', error);
    res.status(500).json({ error: 'Failed to fetch languages' });
  }
};
