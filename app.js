// ============================================================
//  app.js — MockMind Core App Controller
//  State management, page routing, UI coordination
// ============================================================

// ─── App State ───────────────────────────────────────────────
const AppState = {
  mode:           null,       // 'subject' | 'behavioural'
  subjects:       [],
  categories:     [],
  difficulty:     'intermediate',
  totalQuestions: 10,
  inputMode:      'chat',     // 'chat' | 'voice'
  currentPage:    'setup',
  sessionActive:  false,
  questionQueue:  [],
  currentQ:       null,
  qaHistory:      [],         // {question, answer, score, metadata}
};

// ─── Subject / Category Data ──────────────────────────────────
const SUBJECTS = [
  'Python', 'Java', 'JavaScript', 'TypeScript', 'C++', 'C#',
  'DSA', 'SQL', 'Machine Learning', 'System Design',
  'React', 'Node.js', 'REST APIs', 'DevOps', 'Cloud (AWS/GCP)'
];

const CATEGORIES = [
  'Leadership', 'Teamwork', 'Conflict Resolution',
  'Problem Solving', 'Communication', 'Time Management',
  'Adaptability', 'Initiative', 'Creativity', 'Decision Making'
];

const QUESTION_COUNTS = [5, 10, 15];

// ─── DOM References (cached) ──────────────────────────────────
const $ = id => document.getElementById(id);

// ─── Page Navigation ──────────────────────────────────────────
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  $(pageId).classList.add('active');
  AppState.currentPage = pageId.replace('page-', '');
}

// ─── Toast Notification ───────────────────────────────────────
function showToast(msg, duration = 4000) {
  const toast = $('toast');
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), duration);
}

// ─── Loading Overlay ──────────────────────────────────────────
function showLoading(text = 'AI is thinking...') {
  $('loading-overlay').classList.add('visible');
  $('loading-text').textContent = text;
}

function hideLoading() {
  $('loading-overlay').classList.remove('visible');
}

// ─── Difficulty Badge HTML ─────────────────────────────────────
function diffBadge(level) {
  return `<span class="badge badge-${level}">${level}</span>`;
}

// ─── Subject / Category Chips ──────────────────────────────────
function renderSubjectChips() {
  const container = $('subject-chips');
  container.innerHTML = SUBJECTS.map(s =>
    `<div class="chip" data-value="${s}" onclick="toggleChip(this,'subject')">${s}</div>`
  ).join('');
}

function renderCategoryChips() {
  const container = $('category-chips');
  container.innerHTML = CATEGORIES.map(c =>
    `<div class="chip" data-value="${c}" onclick="toggleChip(this,'category')">${c}</div>`
  ).join('');
}

function toggleChip(el, type) {
  el.classList.toggle('selected');
  if (type === 'subject') {
    const val = el.dataset.value;
    if (el.classList.contains('selected')) {
      if (!AppState.subjects.includes(val)) AppState.subjects.push(val);
    } else {
      AppState.subjects = AppState.subjects.filter(s => s !== val);
    }
  } else {
    const val = el.dataset.value;
    if (el.classList.contains('selected')) {
      if (!AppState.categories.includes(val)) AppState.categories.push(val);
    } else {
      AppState.categories = AppState.categories.filter(c => c !== val);
    }
  }
}

// ─── Setup: Mode Cards ────────────────────────────────────────
function selectMode(mode) {
  AppState.mode = mode;

  // Update card selection
  document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
  document.querySelector(`[data-mode="${mode}"]`).classList.add('selected');

  // Show correct config panel
  $('config-subject').classList.remove('visible');
  $('config-behavioural').classList.remove('visible');

  if (mode === 'subject')      $('config-subject').classList.add('visible');
  if (mode === 'behavioural')  $('config-behavioural').classList.add('visible');
}

// ─── Difficulty Buttons ───────────────────────────────────────
function selectDifficulty(el, prefix) {
  const level = el.dataset.level;
  AppState.difficulty = level;
  document.querySelectorAll(`[data-prefix="${prefix}"]`).forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

// ─── Question Count ───────────────────────────────────────────
function selectCount(el, prefix) {
  AppState.totalQuestions = parseInt(el.dataset.count);
  document.querySelectorAll(`[data-count-prefix="${prefix}"]`).forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

// ─── Input Mode ───────────────────────────────────────────────
function selectInputMode(mode, prefix) {
  AppState.inputMode = mode;
  document.querySelectorAll(`[data-toggle-prefix="${prefix}"]`).forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-toggle-prefix="${prefix}"][data-input="${mode}"]`).classList.add('active');
}

// ─── Validate & Start Interview ───────────────────────────────
async function startInterview() {
  // Validation
  if (!AppState.mode) return showToast('⚠️ Please select an interview mode.');

  if (AppState.mode === 'subject' && AppState.subjects.length === 0) {
    return showToast('⚠️ Please select at least one subject.');
  }
  if (AppState.mode === 'behavioural' && AppState.categories.length === 0) {
    return showToast('⚠️ Please select at least one category.');
  }

  // Voice support check
  if (AppState.inputMode === 'voice') {
    const support = VoiceEngine.checkVoiceSupport();
    if (!support.speechRecognition) {
      showToast('⚠️ Voice mode requires Chrome browser. Switching to Chat mode.');
      AppState.inputMode = 'chat';
    }
  }

  // Configure session
  GeminiEngine.initSession({
    mode:           AppState.mode,
    subjects:       AppState.subjects,
    categories:     AppState.categories,
    difficulty:     AppState.difficulty,
    totalQuestions: AppState.totalQuestions,
  });

  AppState.qaHistory = [];
  AppState.sessionActive = true;

  // Navigate to chat
  showPage('page-chat');
  initChatUI();

  // Get first question
  await fetchAndDisplayNextQuestion(true);
}

// ─── Chat UI Init ─────────────────────────────────────────────
function initChatUI() {
  // Clear messages
  $('messages-area').innerHTML = '';
  AppState.currentQ = null;

  // Set header badges
  const modeLabel = AppState.mode === 'subject' ? '🎯 Technical' : '🧠 Behavioural';
  $('chat-mode-badge').innerHTML = `<span class="badge badge-purple">${modeLabel}</span>`;

  // Update progress
  updateProgress(0);

  // Set input mode
  switchChatInputMode(AppState.inputMode, false);

  // Enable / disable send
  updateSendButton(false);
}

// ─── Progress Bar ─────────────────────────────────────────────
function updateProgress(currentNum) {
  const total = AppState.totalQuestions;
  const pct   = Math.round((currentNum / total) * 100);
  $('progress-bar-fill').style.width = `${pct}%`;
  $('progress-text').textContent = `Q${currentNum} / ${total}`;
}

// ─── Append Message Bubble ────────────────────────────────────
function appendMessage(role, text, meta = {}) {
  const area = $('messages-area');
  const isAI = role === 'ai';
  const time  = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const diffHtml = meta.difficulty
    ? `<span class="badge badge-${meta.difficulty}" style="font-size:0.65rem">${meta.difficulty}</span>`
    : '';
  const tagHtml = (meta.subject || meta.category)
    ? `<span class="badge badge-info" style="font-size:0.65rem">${meta.subject || meta.category}</span>`
    : '';
  const typeHtml = meta.type && meta.type !== 'new'
    ? `<span class="badge badge-warning" style="font-size:0.65rem">${meta.type === 'followup' ? '↩ Follow-up' : '🔁 Cross-Q'}</span>`
    : '';

  const msgEl = document.createElement('div');
  msgEl.className = `msg msg-${isAI ? 'ai' : 'user'}`;
  msgEl.innerHTML = `
    <div class="msg-avatar">${isAI ? '🤖' : '👤'}</div>
    <div class="msg-body">
      <div class="msg-meta">
        <span>${isAI ? 'MockMind AI' : 'You'}</span>
        <span>${time}</span>
        ${diffHtml} ${tagHtml} ${typeHtml}
      </div>
      <div class="msg-bubble">${escapeHtml(text)}</div>
    </div>
  `;

  area.appendChild(msgEl);
  area.scrollTop = area.scrollHeight;
  return msgEl;
}

// ─── Typing Indicator ─────────────────────────────────────────
function showTyping() {
  const area = $('messages-area');
  const el = document.createElement('div');
  el.className = 'typing-indicator';
  el.id = 'typing-indicator';
  el.innerHTML = `
    <div class="msg-avatar" style="background:linear-gradient(135deg,#7c3aed,#3b82f6)">🤖</div>
    <div class="typing-dots">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  area.appendChild(el);
  area.scrollTop = area.scrollHeight;
}

function hideTyping() {
  const el = $('typing-indicator');
  if (el) el.remove();
}

// ─── Fetch and Display Next Question ─────────────────────────
async function fetchAndDisplayNextQuestion(isFirst = false) {
  showTyping();
  updateSendButton(false);

  try {
    let parsed;
    if (isFirst) {
      parsed = await GeminiEngine.getFirstQuestion();
    } else {
      // The answer was already submitted in handleUserAnswer
      // parsed is already set from submitAnswer
      return;
    }

    hideTyping();
    displayQuestion(parsed);

  } catch (err) {
    hideTyping();
    showToast(`❌ Error: ${err.message}`);
    console.error(err);
    updateSendButton(true);
  }
}

// ─── Display a Question ───────────────────────────────────────
function displayQuestion(parsed) {
  if (!parsed || parsed.question === 'INTERVIEW_COMPLETE') {
    endSession();
    return;
  }

  AppState.currentQ = parsed;

  const prog = GeminiEngine.getProgress();
  updateProgress(prog.current);

  // Update header difficulty badge
  $('difficulty-badge').className = `badge badge-${parsed.difficulty}`;
  $('difficulty-badge').textContent = parsed.difficulty;

  appendMessage('ai', parsed.question, {
    difficulty: parsed.difficulty,
    subject:    parsed.subject,
    category:   parsed.category,
    type:       parsed.type,
  });

  // Voice mode: read question aloud then start mic
  if (AppState.inputMode === 'voice') {
    VoiceEngine.speak(parsed.question, () => {
      startVoiceListening();
    });
  } else {
    updateSendButton(true);
    $('user-input').focus();
  }
}

// ─── Handle User Answer (Chat) ────────────────────────────────
async function handleChatSend() {
  const input = $('user-input');
  const answer = input.value.trim();
  if (!answer) return;

  input.value = '';
  input.style.height = 'auto';
  await processAnswer(answer);
}

// ─── Process Answer (Common for Chat + Voice) ─────────────────
async function processAnswer(answer) {
  updateSendButton(false);

  // Show user message
  appendMessage('user', answer);

  // Save to history
  AppState.qaHistory.push({
    question: AppState.currentQ?.question || '',
    answer,
    metadata: AppState.currentQ || {}
  });

  // Show typing
  showTyping();

  try {
    const { parsed, isComplete } = await GeminiEngine.submitAnswer(answer);
    hideTyping();

    if (isComplete) {
      // Show last question's evaluation then end
      setTimeout(() => endSession(), 600);
    } else {
      displayQuestion(parsed);
    }
  } catch (err) {
    hideTyping();
    showToast(`❌ Error: ${err.message}`);
    console.error(err);
    updateSendButton(true);
  }
}

// ─── Voice Mode Controls ──────────────────────────────────────
function startVoiceListening() {
  const micBtn = $('mic-btn');
  micBtn.classList.add('listening');
  micBtn.innerHTML = '⏹️';
  micBtn.title = 'Click to stop';

  $('voice-status-text').textContent = 'Listening... speak your answer';
  $('live-transcript').textContent = '';

  VoiceEngine.startListening({
    onStart: () => {},
    onEnd: (transcript) => {
      micBtn.classList.remove('listening');
      micBtn.innerHTML = '🎤';
      $('voice-status-text').textContent = 'Click mic to answer';

      if (transcript && transcript.length > 2) {
        processAnswer(transcript);
      } else {
        updateSendButton(true);
      }
    },
    onError: (errType) => {
      micBtn.classList.remove('listening');
      micBtn.innerHTML = '🎤';
      $('voice-status-text').textContent = 'Error — try again';
      showToast(`🎤 Voice error: ${errType}. Try again.`);
      updateSendButton(true);
    }
  });
}

function toggleMic() {
  if (VoiceEngine.getIsListening()) {
    VoiceEngine.stopListening();
  } else {
    startVoiceListening();
  }
}

// ─── Switch Input Mode in Chat ────────────────────────────────
function switchChatInputMode(mode, startNow = true) {
  AppState.inputMode = mode;

  // Update buttons
  document.querySelectorAll('.mode-mini-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.mode-mini-btn[data-input="${mode}"]`)?.classList.add('active');

  if (mode === 'voice') {
    $('voice-panel').classList.add('visible');
    $('text-panel').classList.add('hidden');
    if (startNow && AppState.currentQ) startVoiceListening();
  } else {
    $('voice-panel').classList.remove('visible');
    $('text-panel').classList.remove('hidden');
    VoiceEngine.stopSpeaking();
    VoiceEngine.stopListening();
    updateSendButton(true);
    $('user-input').focus();
  }
}

// ─── Send Button State ────────────────────────────────────────
function updateSendButton(enabled) {
  const btn = $('send-btn');
  const input = $('user-input');
  if (btn) btn.disabled = !enabled;
  if (input) input.disabled = !enabled;
}

// ─── End Session ──────────────────────────────────────────────
async function endSession() {
  AppState.sessionActive = false;
  VoiceEngine.stopSpeaking();
  VoiceEngine.stopListening();

  showLoading('Generating your feedback report...');

  try {
    const feedback = await GeminiEngine.generateFeedback();
    hideLoading();
    renderSummary(feedback);
    showPage('page-summary');
  } catch (err) {
    hideLoading();
    showToast('⚠️ Could not generate feedback. Showing basic summary.');
    console.error(err);
    renderBasicSummary();
    showPage('page-summary');
  }
}

// ─── Render Summary Page ──────────────────────────────────────
function renderSummary(feedback) {
  const scoreRing = $('score-ring');
  const scorePct  = Math.round((feedback.overallScore / 10) * 100);
  scoreRing.style.setProperty('--score-pct', `${scorePct}%`);
  $('score-value').textContent = `${feedback.overallScore}/10`;
  $('score-grade').textContent = feedback.overallGrade || '';
  $('score-summary').textContent = feedback.summary || '';

  // Strengths
  $('strengths-list').innerHTML = (feedback.strengths || [])
    .map(s => `<li>${escapeHtml(s)}</li>`).join('');

  // Areas to Improve
  $('improve-list').innerHTML = (feedback.areasToImprove || [])
    .map(a => `<li>${escapeHtml(a)}</li>`).join('');

  // Per-question breakdown
  const breakdown = $('breakdown-list');
  breakdown.innerHTML = (feedback.perQuestion || AppState.qaHistory).map((item, i) => {
    const score = item.score || 0;
    const scoreClass = score >= 7 ? 'high' : score >= 5 ? 'mid' : 'low';
    return `
      <div class="breakdown-item glass-card">
        <div class="breakdown-item-header">
          <div class="q-number">${i + 1}</div>
          <div class="breakdown-question">${escapeHtml(item.question || '')}</div>
          <div class="score-pill ${scoreClass}">${score}/10</div>
        </div>
        <div class="breakdown-answer">"${escapeHtml((item.answer || '').substring(0, 200))}${(item.answer||'').length > 200 ? '...' : ''}"</div>
        <div class="breakdown-feedback">${escapeHtml(item.feedback || item.internalFeedback || '')}</div>
        ${(item.idealPoints || []).length > 0 ? `
          <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">
            ${(item.idealPoints).map(p => `<span class="topic-chip">${escapeHtml(p)}</span>`).join('')}
          </div>` : ''}
      </div>
    `;
  }).join('');

  // Recommended topics
  $('recommended-topics').innerHTML = (feedback.recommendedTopics || [])
    .map(t => `<span class="topic-chip">${escapeHtml(t)}</span>`).join('');

  $('next-steps-text').textContent = feedback.nextSteps || '';
}

function renderBasicSummary() {
  const total = AppState.qaHistory.length;
  $('score-ring').style.setProperty('--score-pct', '50%');
  $('score-value').textContent = `${total}/10`;
  $('score-grade').textContent = 'Complete';
  $('score-summary').textContent = `You completed ${total} questions. Feedback generation failed — please check your API key.`;
  $('strengths-list').innerHTML = '<li>Session completed</li>';
  $('improve-list').innerHTML = '<li>Retry for detailed feedback</li>';
  $('breakdown-list').innerHTML = AppState.qaHistory.map((item, i) => `
    <div class="breakdown-item glass-card">
      <div class="breakdown-item-header">
        <div class="q-number">${i+1}</div>
        <div class="breakdown-question">${escapeHtml(item.question)}</div>
      </div>
      <div class="breakdown-answer">"${escapeHtml((item.answer||'').substring(0,200))}"</div>
    </div>
  `).join('');
}

// ─── Restart App ──────────────────────────────────────────────
function restartApp() {
  AppState.mode           = null;
  AppState.subjects       = [];
  AppState.categories     = [];
  AppState.difficulty     = 'intermediate';
  AppState.totalQuestions = 10;
  AppState.inputMode      = 'chat';
  AppState.qaHistory      = [];
  AppState.currentQ       = null;

  // Reset chip selections
  document.querySelectorAll('.chip.selected').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.mode-card.selected').forEach(c => c.classList.remove('selected'));
  $('config-subject').classList.remove('visible');
  $('config-behavioural').classList.remove('visible');

  // Reset difficulty buttons
  document.querySelectorAll('.diff-btn').forEach(b => {
    b.classList.remove('active');
    if (b.dataset.level === 'intermediate') b.classList.add('active');
  });

  // Reset count buttons
  document.querySelectorAll('.count-btn').forEach(b => {
    b.classList.remove('active');
    if (b.dataset.count === '10') b.classList.add('active');
  });

  showPage('page-setup');
}

// ─── Auto-resize Textarea ─────────────────────────────────────
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 150) + 'px';
}

// ─── Escape HTML ──────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Key Bindings ─────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (AppState.currentPage === 'chat' && e.key === 'Enter' && !e.shiftKey) {
    const input = $('user-input');
    if (document.activeElement === input && AppState.inputMode === 'chat') {
      e.preventDefault();
      handleChatSend();
    }
  }
});

// ─── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderSubjectChips();
  renderCategoryChips();

  // Set default difficulty active
  document.querySelectorAll('.diff-btn[data-level="intermediate"]').forEach(b => b.classList.add('active'));

  // Set default count active
  document.querySelectorAll('.count-btn[data-count="10"]').forEach(b => b.classList.add('active'));

  // Set default toggle active
  document.querySelectorAll('.toggle-btn[data-input="chat"]').forEach(b => b.classList.add('active'));

  showPage('page-setup');
  console.log('✅ MockMind AI Chatbot initialized');
});
