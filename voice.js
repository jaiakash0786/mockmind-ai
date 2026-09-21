// ============================================================
//  voice.js — Web Speech API Integration
//  Handles: Speech-to-Text (mic input) + Text-to-Speech (TTS)
// ============================================================

let recognition      = null;
let isListening      = false;
let silenceTimer     = null;
let onResultCallback = null;
let onStartCallback  = null;
let onEndCallback    = null;
let onErrorCallback  = null;
let finalTranscript  = '';
let isSpeaking       = false;

// ─── Feature Detection ────────────────────────────────────────
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const hasSpeechRecognition = !!SpeechRecognition;
const hasTTS = 'speechSynthesis' in window;

// ─── Initialize Speech Recognition ───────────────────────────
function initRecognition() {
  if (!hasSpeechRecognition) {
    console.warn('SpeechRecognition not supported in this browser. Use Chrome.');
    return false;
  }

  recognition = new SpeechRecognition();
  recognition.lang            = 'en-US';
  recognition.interimResults  = true;   // show words as they come in
  recognition.continuous      = true;   // keep listening until we stop it
  recognition.maxAlternatives = 1;

  // ── Handlers ──
  recognition.onstart = () => {
    isListening = true;
    finalTranscript = '';
    if (onStartCallback) onStartCallback();
    startWaveformAnimation();
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interimTranscript += transcript;
      }
    }

    // Update live transcript display
    const liveEl = document.getElementById('live-transcript');
    if (liveEl) {
      liveEl.textContent = finalTranscript + interimTranscript;
    }

    // Reset silence timer on new speech
    resetSilenceTimer();
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    isListening = false;
    stopWaveformAnimation();
    if (onErrorCallback) onErrorCallback(event.error);
  };

  recognition.onend = () => {
    isListening = false;
    stopWaveformAnimation();
    clearTimeout(silenceTimer);
    if (onEndCallback) onEndCallback(finalTranscript.trim());
  };

  return true;
}

// ─── Silence Detection ────────────────────────────────────────
function resetSilenceTimer() {
  clearTimeout(silenceTimer);
  silenceTimer = setTimeout(() => {
    // 2.5 seconds of silence → auto-submit
    if (isListening && finalTranscript.trim().length > 0) {
      stopListening();
    }
  }, 2500);
}

// ─── Start Listening ──────────────────────────────────────────
function startListening(callbacks = {}) {
  if (!hasSpeechRecognition) {
    alert('Your browser does not support voice input. Please use Google Chrome.');
    return;
  }

  // Re-init to avoid state issues
  initRecognition();

  onResultCallback = callbacks.onResult || null;
  onStartCallback  = callbacks.onStart  || null;
  onEndCallback    = callbacks.onEnd    || null;
  onErrorCallback  = callbacks.onError  || null;

  try {
    recognition.start();
  } catch (e) {
    console.error('Could not start recognition:', e);
  }
}

// ─── Stop Listening ───────────────────────────────────────────
function stopListening() {
  if (recognition && isListening) {
    recognition.stop();
  }
}

// ─── TTS: Speak a Question ────────────────────────────────────
function speak(text, onDone = null) {
  if (!hasTTS) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  isSpeaking = true;
  const utterance       = new SpeechSynthesisUtterance(text);
  utterance.lang        = 'en-US';
  utterance.rate        = 0.88;
  utterance.pitch       = 1.0;
  utterance.volume      = 1.0;

  // Prefer a natural voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.name.includes('Google') ||
    v.name.includes('Natural') ||
    v.name.includes('Samantha') ||
    v.name.includes('Karen')
  );
  if (preferred) utterance.voice = preferred;

  utterance.onend = () => {
    isSpeaking = false;
    if (onDone) onDone();
  };

  utterance.onerror = () => {
    isSpeaking = false;
    if (onDone) onDone();
  };

  window.speechSynthesis.speak(utterance);
}

// ─── Stop TTS ─────────────────────────────────────────────────
function stopSpeaking() {
  window.speechSynthesis.cancel();
  isSpeaking = false;
}

// ─── Waveform Animation ───────────────────────────────────────
let waveformInterval = null;

function startWaveformAnimation() {
  const bars = document.querySelectorAll('.wave-bar');
  if (!bars.length) return;

  waveformInterval = setInterval(() => {
    bars.forEach(bar => {
      const height = Math.random() * 30 + 5;
      bar.style.height = `${height}px`;
    });
  }, 150);
}

function stopWaveformAnimation() {
  if (waveformInterval) {
    clearInterval(waveformInterval);
    waveformInterval = null;
  }
  const bars = document.querySelectorAll('.wave-bar');
  bars.forEach(bar => { bar.style.height = '5px'; });
}

// ─── Check Support ────────────────────────────────────────────
function checkVoiceSupport() {
  return {
    speechRecognition: hasSpeechRecognition,
    tts: hasTTS
  };
}

function getIsListening() { return isListening; }
function getIsSpeaking()  { return isSpeaking;  }

// ─── Export ───────────────────────────────────────────────────
window.VoiceEngine = {
  startListening,
  stopListening,
  speak,
  stopSpeaking,
  checkVoiceSupport,
  getIsListening,
  getIsSpeaking
};
