// ============================================================
//  gemini.js — Gemini API Integration & Adaptive AI Engine
// ============================================================

// API key & model — loaded from config.js (gitignored, never pushed to GitHub)
// To set up: copy config.example.js → config.js and add your own API key
if (!window.GEMINI_CONFIG || !window.GEMINI_CONFIG.apiKey || window.GEMINI_CONFIG.apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
  alert('⚠️ API key not configured!\n\n1. Copy config.example.js → config.js\n2. Add your Gemini API key inside config.js\n3. Refresh the page');
  throw new Error('config.js not found or API key not set. See config.example.js for instructions.');
}
const GEMINI_API_KEY = window.GEMINI_CONFIG.apiKey;
const GEMINI_MODEL = window.GEMINI_CONFIG.model || 'gemini-1.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

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

// ─── Core API Call (with smart retry + countdown) ────────────────
async function callGemini(messages, systemPrompt = null, retries = 3, maxTokens = 1024) {
  const body = {
    contents: messages,
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: maxTokens,
    }
  };

  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
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

    const errData = await response.json().catch(() => ({}));
    const status = response.status;
    const errMsg = errData.error?.message || response.statusText || '';

    // ─ Parse retry delay from API error message (e.g. "Please retry in 27.66s") ─
    const retryMatch = errMsg.match(/retry in ([\d.]+)s/i);
    const suggestedWait = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 0;

    const isRateLimit = status === 429 || errMsg.toLowerCase().includes('quota');
    const isRetryable = isRateLimit || status === 503 || status === 500;

    if (isRetryable && attempt < retries) {
      // Use suggested wait + 2s buffer, minimum 5s
      const waitSec = suggestedWait > 0 ? suggestedWait + 2 : Math.pow(2, attempt) * 2;

      if (isRateLimit) {
        // Show countdown in the UI
        await showCountdown(waitSec, `⏳ Rate limit hit — retrying in`);
      } else {
        console.warn(`Gemini ${status} — retrying in ${waitSec}s (attempt ${attempt}/${retries})...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
      }
      continue;
    }

    throw new Error(`Gemini API Error: ${errMsg}`);
  }
}

// ─── Countdown Helper ────────────────────────────────────────────
async function showCountdown(seconds, label) {
  return new Promise(resolve => {
    let remaining = seconds;
    const toast = document.getElementById('toast');

    // Reuse the toast element for the countdown
    const update = () => {
      if (toast) {
        toast.textContent = `${label} ${remaining}s...`;
        toast.style.background = 'rgba(255,255,255,0.06)';
        toast.style.borderColor = 'rgba(255,255,255,0.2)';
        toast.style.color = '#d1d5db';
        toast.classList.add('visible');
      }
    };

    update();
    const interval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(interval);
        if (toast) toast.classList.remove('visible');
        resolve();
      } else {
        update();
      }
    }, 1000);
  });
}

// ─── Parse JSON safely from Gemini output ────────────────────────
function parseGeminiJSON(text) {
  // Step 1: strip markdown fences
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Step 2: extract the first { ... } block only
  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1) cleaned = cleaned.slice(start, end + 1);

  // Step 3: try direct parse
  try { return JSON.parse(cleaned); } catch (_) {}

  // Step 4: fix common Gemini JSON issues
  const fixed = cleaned
    .replace(/,\s*([}\]])/g, '$1')               // trailing commas
    .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')   // unquoted keys
    .replace(/:\s*'([^']*)'/g, ': "$1"')          // single-quoted values
    .replace(/[\x00-\x1F\x7F]/g, ' ');            // control chars
  try { return JSON.parse(fixed); } catch (_) {}

  // Step 5: repair truncated JSON (response was cut off mid-way)
  try {
    let repaired = cleaned;
    const qCount = (repaired.match(/"/g) || []).length;
    if (qCount % 2 !== 0) repaired += '"';                                    // close open string
    const ob = (repaired.match(/\{/g)||[]).length, cb = (repaired.match(/\}/g)||[]).length;
    const oa = (repaired.match(/\[/g)||[]).length, ca = (repaired.match(/\]/g)||[]).length;
    for (let i = 0; i < oa - ca; i++) repaired += ']';                        // close open arrays
    for (let i = 0; i < ob - cb; i++) repaired += '}';                        // close open objects
    return JSON.parse(repaired);
  } catch (e) {
    throw new Error('Could not parse Gemini JSON: ' + e.message);
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
  const qaHistory = questionScores;

  // Compact prompt — short strings prevent token-limit truncation
  const feedbackPrompt =
`You are an expert interview coach. Respond with ONLY a valid JSON object — no markdown, no commentary.

Mode: ${sessionConfig.mode === 'subject' ? 'Technical' : 'Behavioural'}
Topics: ${sessionConfig.mode === 'subject' ? sessionConfig.subjects.join(', ') : sessionConfig.categories.join(', ')}

Interview Q&A (scored 1-10):
${qaHistory.map((h, i) => `Q${i+1}: ${h.question.substring(0,120)}\nA: ${h.answer.substring(0,120)}\nScore: ${h.score}/10`).join('\n\n')}

Return EXACTLY this JSON (strings max 100 chars, no trailing commas):
{"overallScore":7.5,"overallGrade":"Good","summary":"2 sentence summary.","strengths":["s1","s2"],"areasToImprove":["a1","a2"],"perQuestion":[{"question":"q","answer":"a","score":7,"feedback":"brief","idealPoints":["p1"]}],"recommendedTopics":["t1","t2"],"nextSteps":"brief next step."}`;

  const messages = [{ role: 'user', parts: [{ text: feedbackPrompt }] }];

  // 3000 tokens — enough for full feedback without truncation
  const rawText = await callGemini(messages, null, 3, 3000);
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
