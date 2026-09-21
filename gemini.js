// ============================================================
//  gemini.js — Gemini API Integration & Adaptive AI Engine
// ============================================================

// API key & model loaded from config.js (gitignored — see config.example.js)
if (!window.GEMINI_CONFIG) throw new Error('config.js not loaded. Copy config.example.js → config.js and add your API key.');
const GEMINI_API_KEY = window.GEMINI_CONFIG.apiKey;
const GEMINI_MODEL   = window.GEMINI_CONFIG.model || 'gemini-2.5-flash';
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ─── Session State ────────────────────────────────────────────
let conversationHistory = [];  // multi-turn memory
let sessionConfig = {};  // set by app.js before starting
let questionScores = [];  // per-question evaluations
let currentDifficulty = 'intermediate';
let questionCount = 0;

// ─── Difficulty Levels ────────────────────────────────────────
const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];

// ─── System Prompts ───────────────────────────────────────────
function buildSystemPrompt(config) {
  const { mode, subjects, categories, difficulty, totalQuestions } = config;

  if (mode === 'subject') {
    return `You are a senior technical interviewer with 15+ years of experience at top tech companies.

INTERVIEW CONFIGURATION:
- Mode: Technical/Subject-Wise Interview
- Subjects: ${subjects.join(', ')}
- Starting Difficulty: ${difficulty}
- Total Questions: ${totalQuestions}

YOUR BEHAVIOUR:
1. Ask ONE technical question at a time. Never ask multiple questions in one turn.
2. After the candidate answers, EVALUATE their response (internally score 1-10).
3. ADAPT the difficulty:
   - Score 8-10: Increase difficulty or ask a deep cross/follow-up question on the same topic.
   - Score 5-7: Stay at the same level, ask a related question.
   - Score 1-4: Decrease difficulty, ask a simpler or more foundational question.
4. Mix questions across the selected subjects (${subjects.join(', ')}).
5. Ask cross-questions (follow-ups) when the answer reveals gaps or is partially correct.
6. Be professional but encouraging — like a real interviewer at Google/Amazon/Microsoft.
7. DO NOT reveal scores to the candidate during the interview.

RESPONSE FORMAT:
For each turn, respond with ONLY a JSON object like this:
{
  "question": "Your next interview question here",
  "difficulty": "beginner|intermediate|advanced|expert",
  "subject": "The subject this question covers",
  "type": "new|followup|crossquestion",
  "internalScore": 7,
  "internalFeedback": "Brief note about their previous answer",
  "questionNumber": 2
}

Start the interview now by asking the first question.`;
  }

  if (mode === 'behavioural') {
    return `You are a senior HR Manager and Behavioural Interview Expert with 15+ years conducting interviews at Fortune 500 companies.

INTERVIEW CONFIGURATION:
- Mode: Behavioural Interview
- Categories: ${categories.join(', ')}
- Starting Difficulty: ${difficulty}
- Total Questions: ${totalQuestions}

YOUR BEHAVIOUR:
1. Ask ONE behavioural question at a time using the STAR method framework (Situation, Task, Action, Result).
2. After each answer, EVALUATE the response quality:
   - Did they use the STAR structure?
   - Was the situation relevant and clear?
   - Did they explain their personal contribution?
   - Was the result quantified or meaningful?
3. ADAPT based on response:
   - Strong (8-10): Ask a deeper, more nuanced scenario or a follow-up probing their leadership/decision-making.
   - Average (5-7): Ask a related scenario at the same complexity.
   - Weak (1-4): Ask a simpler scenario or guide them with a gentler version.
4. Mix categories across: ${categories.join(', ')}.
5. Ask probing follow-ups like "And what would you do differently?" or "How did your team react?"
6. Be warm but probing — like a top HR interviewer at a leading company.

RESPONSE FORMAT:
For each turn, respond with ONLY a JSON object like this:
{
  "question": "Your next behavioural question here",
  "difficulty": "beginner|intermediate|advanced|expert",
  "category": "The category this question covers (e.g. Leadership)",
  "type": "new|followup|probing",
  "internalScore": 7,
  "internalFeedback": "Brief note about their previous answer",
  "questionNumber": 2
}

Start the interview now by asking the first behavioural question.`;
  }
}

// ─── Feedback System Prompt ───────────────────────────────────
function buildFeedbackPrompt(history, config) {
  return `You are an expert interview coach. Based on the following interview session, provide comprehensive feedback.

INTERVIEW MODE: ${config.mode === 'subject' ? 'Technical/Subject-Wise' : 'Behavioural'}
${config.mode === 'subject' ? `SUBJECTS: ${config.subjects.join(', ')}` : `CATEGORIES: ${config.categories.join(', ')}`}

INTERVIEW TRANSCRIPT:
${history.map((h, i) => `Q${i + 1}: ${h.question}\nAnswer: ${h.answer}\nInternal Score: ${h.score}/10`).join('\n\n')}

Provide a detailed JSON feedback object:
{
  "overallScore": 7.5,
  "overallGrade": "Good",
  "summary": "2-3 sentence overall summary",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "areasToImprove": ["area 1", "area 2", "area 3"],
  "perQuestion": [
    {
      "question": "question text",
      "answer": "candidate answer",
      "score": 7,
      "feedback": "specific feedback for this answer",
      "idealPoints": ["key point 1", "key point 2"]
    }
  ],
  "recommendedTopics": ["topic 1", "topic 2", "topic 3"],
  "nextSteps": "What the candidate should focus on next"
}`;
}

// ─── Core API Call (with retry) ──────────────────────────────
async function callGemini(messages, systemPrompt = null, retries = 3) {
  const body = {
    contents: messages,
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    }
  };

  if (systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: systemPrompt }]
    };
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      const data = await response.json();
      return data.candidates[0].content.parts[0].text;
    }

    const err = await response.json().catch(() => ({}));
    const status = response.status;
    const isRetryable = status === 503 || status === 429 || status === 500;

    if (isRetryable && attempt < retries) {
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      console.warn(`Gemini ${status} — retrying in ${delay/1000}s (attempt ${attempt}/${retries})...`);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }

    throw new Error(`Gemini API Error: ${err.error?.message || response.statusText}`);
  }
}

// ─── Parse JSON safely from Gemini output ────────────────────
function parseGeminiJSON(text) {
  try {
    // Remove markdown code fences if present
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    // Fallback: extract JSON object from text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Could not parse Gemini response as JSON');
  }
}

// ─── Public: Initialize Session ──────────────────────────────
function initSession(config) {
  sessionConfig = config;
  conversationHistory = [];
  questionScores = [];
  currentDifficulty = config.difficulty || 'intermediate';
  questionCount = 0;
}

// ─── Public: Get First Question ──────────────────────────────
async function getFirstQuestion() {
  const systemPrompt = buildSystemPrompt(sessionConfig);
  const messages = [
    { role: 'user', parts: [{ text: 'Start the interview.' }] }
  ];

  const rawText = await callGemini(messages, systemPrompt);
  const parsed = parseGeminiJSON(rawText);

  // Save to history
  conversationHistory.push(
    { role: 'user', parts: [{ text: 'Start the interview.' }] },
    { role: 'model', parts: [{ text: rawText }] }
  );

  currentDifficulty = parsed.difficulty || currentDifficulty;
  questionCount = 1;
  return parsed;
}

// ─── Public: Submit Answer & Get Next Question ───────────────
async function submitAnswer(userAnswer) {
  const systemPrompt = buildSystemPrompt(sessionConfig);

  // Add user answer to history
  conversationHistory.push({
    role: 'user',
    parts: [{ text: userAnswer }]
  });

  // Ask for next question (or end signal)
  const isLastQuestion = questionCount >= sessionConfig.totalQuestions;
  const prompt = isLastQuestion
    ? `${userAnswer}\n\n[This was the final answer. Please evaluate it and respond with the JSON format including internalScore but set questionNumber to ${sessionConfig.totalQuestions}. Do not ask another question — set "question" to "INTERVIEW_COMPLETE"]`
    : userAnswer;

  // Temporarily override last user message
  const messages = [...conversationHistory];
  if (isLastQuestion) {
    messages[messages.length - 1] = {
      role: 'user',
      parts: [{ text: prompt }]
    };
  }

  const rawText = await callGemini(messages, systemPrompt);
  const parsed = parseGeminiJSON(rawText);

  // Track score
  if (parsed.internalScore !== undefined) {
    questionScores.push({
      question: parsed.question !== 'INTERVIEW_COMPLETE'
        ? conversationHistory[conversationHistory.length - 2]?.parts[0]?.text || ''
        : 'Final Question',
      answer: userAnswer,
      score: parsed.internalScore,
      feedback: parsed.internalFeedback || ''
    });
  }

  // Add model response to history
  conversationHistory.push({
    role: 'model',
    parts: [{ text: rawText }]
  });

  currentDifficulty = parsed.difficulty || currentDifficulty;
  questionCount++;

  return { parsed, isComplete: parsed.question === 'INTERVIEW_COMPLETE' || isLastQuestion };
}

// ─── Public: Generate Final Feedback ─────────────────────────
async function generateFeedback() {
  // Extract Q&A pairs from history for the feedback prompt
  const qaHistory = questionScores;
  const feedbackPrompt = buildFeedbackPrompt(qaHistory, sessionConfig);

  const messages = [
    { role: 'user', parts: [{ text: feedbackPrompt }] }
  ];

  const rawText = await callGemini(messages);
  return parseGeminiJSON(rawText);
}

// ─── Public: Get Current Difficulty ──────────────────────────
function getCurrentDifficulty() {
  return currentDifficulty;
}

// ─── Public: Get Progress ─────────────────────────────────────
function getProgress() {
  return { current: questionCount, total: sessionConfig.totalQuestions };
}

// ─── Export ───────────────────────────────────────────────────
window.GeminiEngine = {
  initSession,
  getFirstQuestion,
  submitAnswer,
  generateFeedback,
  getCurrentDifficulty,
  getProgress
};
