// src/constants.js

export const KOKORO_VOICES = [
  { id: 'af_heart', label: 'Heart (Female, US - Ultra-Human)' },
  { id: 'af_bella', label: 'Bella (Female, US)' },
  { id: 'af_sarah', label: 'Sarah (Female, US)' },
  { id: 'am_adam', label: 'Adam (Male, US)' },
  { id: 'am_michael', label: 'Michael (Male, US)' },
  { id: 'bf_emma', label: 'Emma (Female, UK)' },
  { id: 'bm_george', label: 'George (Male, UK)' },
];

export const DEFAULTS = {
  MODE: 'adaptive', // 'adaptive' | 'manual' | 'auto'
  SPEAKING_SPEED: 1.0,
  PAUSE_DURATION: 3.2, // Base pause in seconds for standard chunk
  WORDS_PER_CHUNK: 4.5, // Target average chunk size
  VOICE: 'af_heart', // Default Kokoro TTS voice

  // Calibrated handwriting baseline (human writing speed: 18-24 WPM)
  HANDWRITING_WPM: 22,
  MS_PER_CHAR: 380, // Average handwriting stroke duration per character
  COMPLEXITY_SENSITIVITY: 1.4, // How much slower hard words are (1.4x default)

  // Chunking capacities
  EASY_CHUNK_CAPACITY: 6, // Words for simple phrases ("in the middle of the room")
  MEDIUM_CHUNK_CAPACITY: 4, // Words for moderate text ("frequently encountered issues")
  HARD_CHUNK_CAPACITY: 2.5, // Words for dense/technical text ("deoxyribonucleic acid sequencing")
};

export const LIMITS = {
  MIN_WORDS_PER_CHUNK: 2,
  MAX_WORDS_PER_CHUNK: 10,
  MIN_PAUSE: 1.0,
  MAX_PAUSE: 15.0,
  MIN_SPEED: 0.6,
  MAX_SPEED: 1.8,
  MIN_WPM: 10,
  MAX_WPM: 45,
};

export const ADAPTIVE = {
  LEARNING_RATE: 0.20, // Exponential moving average weight for updates
  REPLAY_PENALTY_CHUNK_REDUCE: 0.8, // Words reduced from target when replayed
  REPLAY_PAUSE_EXPANSION: 0.6, // Seconds added to future pauses when replayed
  EARLY_READY_THRESHOLD: 0.65, // Finished with >35% pause remaining -> trim pause
  EARLY_READY_TRIM: 0.35, // Seconds trimmed
  LATE_READY_THRESHOLD: 1.15, // Took longer than calculated pause -> extend
  LATE_READY_EXPAND: 0.5, // Seconds added
};

export const KEYBOARD_SHORTCUTS = {
  READY: ' ', // Space
  REPLAY: 'r',
  SKIP: 'ArrowRight',
  PAUSE_RESUME: 'p',
  RESTART: 'Escape',
};

export const DICTATION_STATES = {
  IDLE: 'idle',
  BUFFERING: 'buffering',    // Pre-generating audio clips before playback starts
  READY: 'ready',
  SPEAKING: 'speaking',
  PAUSED_WAITING: 'paused_waiting', // Auto/Adaptive countdown
  WAITING_READY: 'waiting_ready', // Manual mode: waiting for Space / Ready
  PAUSED_BY_USER: 'paused_by_user',
  COMPLETED: 'completed',
};

export const SAMPLE_CALIBRATION_TEXT = 
  "The quick brown fox jumps over the lazy dog. Synthetic algorithms optimize computational efficiency across distributed microservices with ninety-nine percent accuracy.";
