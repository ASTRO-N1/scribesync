// src/lib/speechEngine.js

/**
 * High-quality Speech Synthesis Engine for ScribeSync.
 * Leverages native Neural / Natural voices (Edge Natural, Google TTS, Siri, Samantha)
 * with zero API fees, zero latency, and 100% offline support.
 */

let voicesLoaded = false;
let availableVoices = [];
let voiceListeners = [];

function refreshVoices() {
  if (!('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices && voices.length > 0) {
    // Filter and score voices
    availableVoices = rankVoices(voices);
    voicesLoaded = true;
    voiceListeners.forEach(fn => fn(availableVoices));
  }
}

/**
 * Ranks voices so natural, neural, human-sounding voices appear first.
 */
function rankVoices(voices) {
  // Prefer English voices
  const englishVoices = voices.filter(v => v.lang.startsWith('en'));
  const candidateList = englishVoices.length > 0 ? englishVoices : voices;

  return candidateList.map(v => {
    let score = 0;
    const name = v.name.toLowerCase();

    // Natural / Neural indicators (Edge, Chrome, Apple, Windows)
    if (name.includes('natural')) score += 50;
    if (name.includes('neural')) score += 40;
    if (name.includes('online')) score += 30;
    if (name.includes('google')) score += 25;
    if (name.includes('samantha') || name.includes('daniel') || name.includes('karen')) score += 20;
    if (name.includes('aria') || name.includes('guy') || name.includes('jenny')) score += 35;
    if (v.lang === 'en-US' || v.lang === 'en-GB') score += 10;

    return {
      id: v.name,
      name: v.name,
      lang: v.lang,
      score,
      isNatural: score >= 25,
      rawVoice: v,
    };
  }).sort((a, b) => b.score - a.score);
}

// Initial voice loader
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    refreshVoices();
  };
}

export function subscribeToVoices(callback) {
  voiceListeners.push(callback);
  if (availableVoices.length > 0) {
    callback(availableVoices);
  } else {
    refreshVoices();
  }
  return () => {
    voiceListeners = voiceListeners.filter(fn => fn !== callback);
  };
}

export function getAvailableVoices() {
  if (availableVoices.length === 0) refreshVoices();
  return availableVoices;
}

/**
 * Speaks an utterance with natural prosody.
 */
export function speakText(text, {
  voiceId = 'auto-natural',
  rate = 1.0,
  pitch = 1.0,
  volume = 1.0,
  onStart,
  onEnd,
  onError,
} = {}) {
  if (!('speechSynthesis' in window)) {
    onError?.(new Error('Speech Synthesis not supported by this browser.'));
    return () => {};
  }

  // Cancel prior speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = Math.max(0.5, Math.min(2.0, rate));
  utterance.pitch = Math.max(0.8, Math.min(1.2, pitch));
  utterance.volume = Math.max(0, Math.min(1.0, volume));

  // Select voice
  const allVoices = getAvailableVoices();
  let selected = null;

  if (voiceId && voiceId !== 'auto-natural') {
    selected = allVoices.find(v => v.id === voiceId)?.rawVoice;
  }

  // Fallback to top-ranked natural voice
  if (!selected && allVoices.length > 0) {
    selected = allVoices[0].rawVoice;
  }

  if (selected) {
    utterance.voice = selected;
  }

  utterance.onstart = () => {
    onStart?.();
  };

  utterance.onend = () => {
    onEnd?.();
  };

  utterance.onerror = (e) => {
    // Avoid error reporting if user simply cancelled speech
    if (e.error === 'interrupted' || e.error === 'canceled') {
      return;
    }
    onError?.(e);
  };

  window.speechSynthesis.speak(utterance);

  // Return cancel function
  return () => {
    window.speechSynthesis.cancel();
  };
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
