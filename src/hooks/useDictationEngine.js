// src/hooks/useDictationEngine.js
import { useState, useRef, useCallback, useEffect } from 'react';
import { DICTATION_STATES, DEFAULTS } from '../constants';
import { chunkText } from '../lib/textChunker';
import { handleRealTimeFeedback } from '../lib/adaptiveAlgorithm';
// ── ML Algorithm imports ─────────────────────────────────────────────────────
import { loadModel, trainOnChunk, predictPauseSec, serializeModelToProfile } from '../lib/onlineRegression';
import { loadBanditState, updateBandit, computeReward, serializeBanditToProfile } from '../lib/chunkBandit';

export function useDictationEngine({
  tts,
  profile,
  saveProfile,
  onSessionComplete,
}) {
  const [state, setState] = useState(DICTATION_STATES.IDLE);
  const [chunks, setChunks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [chunkFeedback, setChunkFeedback] = useState([]);
  const [workingProfile, setWorkingProfile] = useState(profile);
  const [activeSettings, setActiveSettings] = useState({
    mode: profile.preferred_mode || DEFAULTS.MODE,
    voice: profile.preferred_voice || DEFAULTS.VOICE,
    speakingSpeed: profile.speaking_speed || DEFAULTS.SPEAKING_SPEED,
    pauseDuration: profile.avg_pause_duration || DEFAULTS.PAUSE_DURATION,
  });

  const [pauseStartTime, setPauseStartTime] = useState(null);
  const [pauseEndTime, setPauseEndTime] = useState(null);
  const [realtimeInsight, setRealtimeInsight] = useState(null);

  // --- Audio Pre-generation & Buffering Pipeline State ---
  const [bufferState, setBufferState] = useState({
    bufferedCount: 0,
    targetCount: 0,
    totalCount: 0,
    isBuffering: false,
    isBufferReady: false,
    isAllBuffered: false,
    currentBufferingText: '',
  });

  const pauseTimerRef = useRef(null);
  const replayCountRef = useRef(0);
  const speechEndTimestampRef = useRef(null);
  const speechEndedRef = useRef(false);
  const timerExpiredRef = useRef(false);
  const advanceToNextChunkRef = useRef(null);
  const isCalibrationRunRef = useRef(false);
  const isTransitioningRef = useRef(false);
  const generationSessionIdRef = useRef(0);
  const bufferedIndicesRef = useRef(new Set());
  const currentIndexRef = useRef(0);

  // ── ML Algorithm #1: SGD Regression Model (live weights) ─────────────────
  // Loaded from persisted profile weights. Updated after every chunk.
  const regressionWeightsRef = useRef(null);
  const regressionBiasRef    = useRef(null);

  // ── ML Algorithm #2: UCB1 Bandit State (live Q-values) ───────────────────
  // Loaded from persisted profile. Q-values updated after every chunk.
  const banditStateRef = useRef(null);

  // Initialize ML model weights from profile on mount / profile change
  useEffect(() => {
    const { weights, bias } = loadModel(profile);
    regressionWeightsRef.current = weights;
    regressionBiasRef.current    = bias;
    banditStateRef.current = loadBanditState(profile);
  }, [profile]);

  // Sync currentIndexRef with state
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Sync working profile when outside profile changes and not active
  useEffect(() => {
    if (state === DICTATION_STATES.IDLE) {
      setWorkingProfile(profile);
      setActiveSettings(prev => ({
        ...prev,
        mode: profile.preferred_mode || DEFAULTS.MODE,
        voice: profile.preferred_voice || DEFAULTS.VOICE,
        speakingSpeed: profile.speaking_speed || DEFAULTS.SPEAKING_SPEED,
        pauseDuration: profile.avg_pause_duration || DEFAULTS.PAUSE_DURATION,
      }));
    }
  }, [profile, state]);

  // Clean timer on unmount
  useEffect(() => {
    return () => clearTimeout(pauseTimerRef.current);
  }, []);

  /**
   * Start dictation session with source text.
   */
  const startDictation = useCallback((sourceText, customSettings = {}, isCalibration = false) => {
    isCalibrationRunRef.current = isCalibration;
    isTransitioningRef.current = false;
    const settings = { ...activeSettings, ...customSettings };
    setActiveSettings(settings);

    // Dynamic chunking tailored to text complexity & user capacities
    const { chunks: generatedChunks } = chunkText(sourceText, {
      profile: workingProfile,
    });

    if (generatedChunks.length === 0) return;

    setChunks(generatedChunks);
    setCurrentIndex(0);
    setChunkFeedback([]);
    replayCountRef.current = 0;
    setRealtimeInsight(null);

    // If explicitly using browser fallback voice or neural engine failed
    if (settings.voice === '__fallback__' || (tts.status === 'error' && !tts.isModelLoaded)) {
      setBufferState({
        bufferedCount: generatedChunks.length,
        targetCount: generatedChunks.length,
        totalCount: generatedChunks.length,
        isBuffering: false,
        isBufferReady: true,
        isAllBuffered: true,
        currentBufferingText: '',
      });
      setState(DICTATION_STATES.READY);
      return;
    }

    // Audio Pipeline Buffering:
    // Buffer first 5 chunks (or all if < 5) before playback begins.
    // Once threshold is reached, playback starts immediately, while remaining chunks
    // continue generating in the background so the user never experiences latency after spacebar.
    const totalCount = generatedChunks.length;
    const targetCount = Math.min(5, totalCount);

    setBufferState({
      bufferedCount: 0,
      targetCount,
      totalCount,
      isBuffering: true,
      isBufferReady: false,
      isAllBuffered: false,
      currentBufferingText: generatedChunks[0]?.text || '',
    });

    setState(DICTATION_STATES.BUFFERING);

    const sessionId = ++generationSessionIdRef.current;
    bufferedIndicesRef.current = new Set();

    // Helper to yield control to the browser event loop via macrotask (setTimeout).
    // This allows React to commit DOM renders, the browser to paint frames at 60fps,
    // and user clicks/events (such as Exit or Cancel) to be handled without freezing.
    const yieldToMain = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));

    // Schedule generation via macrotask so the browser paints the Buffering View overlay
    // immediately with smooth CSS animations BEFORE any CPU-heavy neural net inference begins!
    setTimeout(async () => {
      if (generationSessionIdRef.current !== sessionId) return;

      // Initial visual paint delay so user sees the 0/5 buffer state & animations immediately
      await yieldToMain(100);
      if (generationSessionIdRef.current !== sessionId) return;

      // --- PHASE 1: Synthesize initial buffer chunks (first 5 chunks) ---
      for (let i = 0; i < targetCount; i++) {
        if (generationSessionIdRef.current !== sessionId) return;

        const chunk = generatedChunks[i];
        setBufferState(prev => ({
          ...prev,
          currentBufferingText: chunk.text,
        }));

        // Yield before starting chunk so preview text and pip status update visually
        await yieldToMain(60);
        if (generationSessionIdRef.current !== sessionId) return;

        try {
          await tts.preload(chunk.spokenText || chunk.text, {
            voice: settings.voice,
            rate: settings.speakingSpeed,
          });
        } catch (err) {
          console.warn(`[DictationEngine] Preload error on chunk ${i}:`, err);
        }

        if (generationSessionIdRef.current !== sessionId) return;

        bufferedIndicesRef.current.add(i);
        const count = bufferedIndicesRef.current.size;

        setBufferState(prev => ({
          ...prev,
          bufferedCount: count,
          isBufferReady: count >= targetCount,
          isAllBuffered: count >= totalCount,
        }));

        // Yield after state update so browser paints the progress bar update smoothly!
        await yieldToMain(50);
        if (generationSessionIdRef.current !== sessionId) return;
      }

      // --- THRESHOLD REACHED: Transition immediately to start dictation ---
      setState(current => {
        if (current === DICTATION_STATES.BUFFERING) {
          return DICTATION_STATES.READY;
        }
        return current;
      });

      // Give browser time to cleanly transition to the active Dictation HUD
      await yieldToMain(150);
      if (generationSessionIdRef.current !== sessionId) return;

      // --- PHASE 2: Smart Rolling Lookahead Buffer (chunks 5 to N) ---
      // Runs in background Web Worker without ANY main-thread blocking.
      // Keeps a rolling lookahead window of 6 chunks ahead of the user's active chunk.
      // When 6 chunks ahead, the worker rests until the user advances with Spacebar.
      // Guarantees 0ms latency for the user while preventing CPU/battery strain on large documents.
      const LOOKAHEAD_WINDOW = 6;
      let nextToBuffer = targetCount;

      while (nextToBuffer < totalCount) {
        if (generationSessionIdRef.current !== sessionId) return;

        // Check if we are already comfortably ahead of the user's current writing position
        const activeIdx = currentIndexRef.current || 0;
        if (nextToBuffer > activeIdx + LOOKAHEAD_WINDOW) {
          // We have a healthy safety buffer ahead! Rest for 400ms before re-checking
          await yieldToMain(400);
          continue;
        }

        const chunk = generatedChunks[nextToBuffer];
        setBufferState(prev => ({
          ...prev,
          currentBufferingText: chunk.text,
        }));

        try {
          await tts.preload(chunk.spokenText || chunk.text, {
            voice: settings.voice,
            rate: settings.speakingSpeed,
          });
        } catch (err) {
          console.warn(`[DictationEngine] Background preload notice on chunk ${nextToBuffer}:`, err);
        }

        if (generationSessionIdRef.current !== sessionId) return;

        bufferedIndicesRef.current.add(nextToBuffer);
        const count = bufferedIndicesRef.current.size;

        setBufferState(prev => ({
          ...prev,
          bufferedCount: count,
          isAllBuffered: count >= totalCount,
        }));

        nextToBuffer++;
        await yieldToMain(120);
      }
    }, 60);
  }, [activeSettings, workingProfile, tts]);

  /**
   * Speak chunk at specific index using Kokoro TTS.
   * Timer begins immediately on the first word as audio begins playing.
   */
  const speakCurrentChunk = useCallback((index, chunksArr, settings, currentProf) => {
    if (index >= chunksArr.length) return;

    const chunk = chunksArr[index];
    setState(DICTATION_STATES.SPEAKING);
    speechEndedRef.current = false;
    timerExpiredRef.current = false;
    clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = null;

    let chunkTotalDurationMs = 3000;

    tts.speak(chunk.spokenText || chunk.text, {
      voice: settings.voice,
      rate: settings.speakingSpeed,
      onStart: ({ duration } = {}) => {
        // --- FIRST WORD HAS STARTED BEING DICTATED! ---
        // Timer begins immediately with the first word as requested!
        const speechDurationSec = duration && duration > 0
          ? duration
          : Math.max(1.5, (chunk.wordCount || 3) / (2.5 * settings.speakingSpeed));

        const basePause = settings.pauseDuration || DEFAULTS.PAUSE_DURATION;

        // \u2500\u2500 ML Algorithm #1: SGD Regression \u2014 Pause Prediction \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        // If the regression model has been trained (weights loaded from profile),
        // use its PREDICTION for how long this specific user needs to write this chunk.
        // This replaces the static formula with a personalized ML-learned estimate.
        let pauseSec;
        if (regressionWeightsRef.current && regressionBiasRef.current) {
          const mlPredictedSec = predictPauseSec(chunk, regressionWeightsRef.current, regressionBiasRef.current);
          // Blend: 60% ML prediction + 40% rule-based estimate for stability while the
          // model is still learning (avoids wild swings in early sessions)
          const ruleBasedSec = chunk.recommendedPauseSec || (basePause * (chunk.pauseMultiplier || 1.0));
          const trainedChunks = currentProf?.regression_trained_chunks || 0;
          // Gradually increase ML trust as the model trains on more chunks
          const mlTrustWeight = Math.min(0.85, 0.3 + trainedChunks * 0.01);
          pauseSec = Number((mlTrustWeight * mlPredictedSec + (1 - mlTrustWeight) * ruleBasedSec).toFixed(1));
        } else {
          pauseSec = chunk.recommendedPauseSec || (basePause * (chunk.pauseMultiplier || 1.0));
        }


        // Total handwriting time allotted starting from word 1:
        const totalDurationSec = Number((speechDurationSec + pauseSec).toFixed(1));
        chunkTotalDurationMs = Math.round(totalDurationSec * 1000);

        const start = Date.now();
        const end = start + chunkTotalDurationMs;
        setPauseStartTime(start);
        setPauseEndTime(end);

        if (settings.mode !== 'manual' && !isCalibrationRunRef.current) {
          clearTimeout(pauseTimerRef.current);
          pauseTimerRef.current = setTimeout(() => {
            timerExpiredRef.current = true;
            // Only auto-advance if speech has also finished:
            if (speechEndedRef.current) {
              advanceToNextChunkRef.current?.(index, chunksArr, settings, currentProf, chunkTotalDurationMs, false);
            }
          }, chunkTotalDurationMs);
        }
      },
      onEnd: () => {
        speechEndedRef.current = true;
        speechEndTimestampRef.current = Date.now();

        // If manual mode or calibration run: wait for Space / Ready
        if (settings.mode === 'manual' || isCalibrationRunRef.current) {
          setState(DICTATION_STATES.WAITING_READY);
        } else {
          // Auto or Adaptive: check if handwriting timer has already expired
          if (timerExpiredRef.current) {
            advanceToNextChunkRef.current?.(index, chunksArr, settings, currentProf, chunkTotalDurationMs, false);
          } else {
            // Speech ended, but user is still writing and timer smoothly continues to 0
            setState(DICTATION_STATES.PAUSED_WAITING);
          }
        }
      },
      onError: (err) => {
        console.error('Kokoro TTS error on chunk:', err);
        speechEndedRef.current = true;
        setState(DICTATION_STATES.READY);
      },
    });
  }, [tts]);

  /**
   * Complete current chunk and proceed cleanly to next chunk.
   */
  const advanceToNextChunk = useCallback((
    index,
    chunksArr,
    settings,
    currentProf,
    readyTimeMs,
    wasManualClick
  ) => {
    // Avoid double transitions from timer and button
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = null;
    tts.cancel();

    const chunk = chunksArr[index];
    const feedbackItem = {
      chunk_index: index,
      chunk_text: chunk.text,
      difficulty: chunk.difficulty,
      word_count: chunk.wordCount,
      char_count: chunk.charCount,
      ready_time_ms: readyTimeMs,
      was_replayed: replayCountRef.current > 0,
      replay_count: replayCountRef.current,
      had_technical: chunk.hasTechnical,
      pause_duration_used: (chunk.recommendedPauseSec || settings.pauseDuration),
    };

    let updatedProf = { ...currentProf };

    // ── ML Algorithm #1: SGD Regression — Online Training Step ──────────────
    // Train the regression model using this chunk's actual writing time as label.
    // This updates the model weights in-place so future predictions improve.
    if (readyTimeMs && readyTimeMs > 500 && !isCalibrationRunRef.current) {
      const { weights: newW, bias: newB, loss, predictedMs } = trainOnChunk({
        chunk,
        actualMs: readyTimeMs,
        weights: regressionWeightsRef.current,
        bias:    regressionBiasRef.current,
      });
      regressionWeightsRef.current = newW;
      regressionBiasRef.current    = newB;
      // Persist trained weights into the profile (saved to localStorage + Supabase later)
      updatedProf = serializeModelToProfile(updatedProf, newW, newB, loss);
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[SGD] chunk="${chunk.text.slice(0,20)}..." predicted=${predictedMs.toFixed(0)}ms actual=${readyTimeMs}ms loss=${loss.toFixed(1)}`);
      }
    }

    // ── ML Algorithm #2: UCB1 Bandit — Online Q-Value Update ────────────────
    // Compute the reward for using (chunk.wordCount words) on a (chunk.difficulty) chunk.
    // Update Q-value for this arm so the bandit learns better chunk sizes over time.
    if (!isCalibrationRunRef.current && banditStateRef.current) {
      const reward = computeReward(feedbackItem, readyTimeMs);
      const chosenArm = chunk.wordCount; // The actual word count used = the arm that was pulled
      const { newState, insight } = updateBandit(
        banditStateRef.current,
        chunk.difficulty,
        chosenArm,
        reward
      );
      banditStateRef.current = newState;
      // Persist bandit state into the profile
      updatedProf = serializeBanditToProfile(updatedProf, newState);
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[Bandit] ${insight}`);
      }
    }

    // Real-time adaptation in Adaptive mode (existing EMA heuristic, unchanged)
    if (settings.mode === 'adaptive' && !isCalibrationRunRef.current) {
      if (wasManualClick && readyTimeMs) {
        const expectedMs = (chunk.recommendedPauseSec || settings.pauseDuration) * 1000;
        if (readyTimeMs < expectedMs * 0.65) {
          const { updatedProfile: newP, insights } = handleRealTimeFeedback('early_ready', chunk, currentProf);
          updatedProf = newP;
          if (insights.length > 0) setRealtimeInsight(insights[0]);
        }
      }
    }

    setWorkingProfile(updatedProf);

    // Update feedback array purely without side-effects inside updater
    setChunkFeedback(prev => [...prev, feedbackItem]);

    const nextIndex = index + 1;

    if (nextIndex >= chunksArr.length) {
      // Session Completed
      setState(DICTATION_STATES.COMPLETED);
      isTransitioningRef.current = false;
      onSessionComplete?.({
        chunks: chunksArr,
        feedback: [...chunkFeedback, feedbackItem],
        settings,
        workingProfile: updatedProf,
        isCalibration: isCalibrationRunRef.current,
      });
    } else {
      // Move to next chunk
      setCurrentIndex(nextIndex);
      replayCountRef.current = 0;
      isTransitioningRef.current = false;
      speakCurrentChunk(nextIndex, chunksArr, settings, updatedProf);
    }
  }, [tts, chunkFeedback, speakCurrentChunk, onSessionComplete]);

  // Keep ref up to date for speakCurrentChunk timer callbacks
  useEffect(() => {
    advanceToNextChunkRef.current = advanceToNextChunk;
  }, [advanceToNextChunk]);

  /**
   * User pressed Ready (Spacebar or CTA)
   * Can be pressed at any time (including while speaking if user finished writing early).
   */
  const handleReady = useCallback(() => {
    if (
      state !== DICTATION_STATES.PAUSED_WAITING &&
      state !== DICTATION_STATES.WAITING_READY &&
      state !== DICTATION_STATES.SPEAKING
    ) return;

    clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = null;
    tts.cancel();

    const readyTimeMs = pauseStartTime
      ? Date.now() - pauseStartTime
      : (speechEndTimestampRef.current ? Date.now() - speechEndTimestampRef.current : 3000);

    advanceToNextChunk(
      currentIndex,
      chunks,
      activeSettings,
      workingProfile,
      readyTimeMs,
      true
    );
  }, [state, currentIndex, chunks, activeSettings, workingProfile, pauseStartTime, advanceToNextChunk, tts]);

  /**
   * User pressed Replay (R)
   */
  const handleReplay = useCallback(() => {
    if (state === DICTATION_STATES.IDLE || state === DICTATION_STATES.COMPLETED) return;

    clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = null;
    isTransitioningRef.current = false;
    tts.cancel();
    replayCountRef.current += 1;

    // Trigger dynamic adaptation for replay
    if (activeSettings.mode === 'adaptive' && !isCalibrationRunRef.current) {
      const currentChunk = chunks[currentIndex];
      if (currentChunk) {
        const { updatedProfile: newP, insights } = handleRealTimeFeedback('replay', currentChunk, workingProfile);
        setWorkingProfile(newP);
        if (insights.length > 0) setRealtimeInsight(insights[0]);
      }
    }

    speakCurrentChunk(currentIndex, chunks, activeSettings, workingProfile);
  }, [state, tts, activeSettings, chunks, currentIndex, workingProfile, speakCurrentChunk]);

  /**
   * Skip to next chunk
   */
  const handleSkip = useCallback(() => {
    if (state === DICTATION_STATES.IDLE || state === DICTATION_STATES.COMPLETED) return;
    clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = null;
    tts.cancel();
    advanceToNextChunk(currentIndex, chunks, activeSettings, workingProfile, null, false);
  }, [state, tts, currentIndex, chunks, activeSettings, workingProfile, advanceToNextChunk]);

  /**
   * Pause / Resume
   */
  const handlePauseResume = useCallback(() => {
    if (state === DICTATION_STATES.SPEAKING) {
      tts.cancel();
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
      setState(DICTATION_STATES.PAUSED_BY_USER);
    } else if (state === DICTATION_STATES.PAUSED_WAITING) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
      setState(DICTATION_STATES.PAUSED_BY_USER);
    } else if (state === DICTATION_STATES.PAUSED_BY_USER) {
      speakCurrentChunk(currentIndex, chunks, activeSettings, workingProfile);
    }
  }, [state, tts, currentIndex, chunks, activeSettings, workingProfile, speakCurrentChunk]);

  /**
   * Stop / Reset
   */
  const handleStop = useCallback(() => {
    generationSessionIdRef.current += 1;
    clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = null;
    isTransitioningRef.current = false;
    tts.cancel();
    setState(DICTATION_STATES.IDLE);
    setCurrentIndex(0);
    setChunks([]);
    setChunkFeedback([]);
    setRealtimeInsight(null);
    setBufferState({
      bufferedCount: 0,
      targetCount: 0,
      totalCount: 0,
      isBuffering: false,
      isBufferReady: false,
      isAllBuffered: false,
      currentBufferingText: '',
    });
  }, [tts]);

  /**
   * Start immediately without waiting for remaining initial buffer
   */
  const startImmediately = useCallback(() => {
    setState(current => {
      if (current === DICTATION_STATES.BUFFERING) {
        return DICTATION_STATES.READY;
      }
      return current;
    });
  }, []);

  // Auto-start first chunk when transition to READY
  useEffect(() => {
    if (state === DICTATION_STATES.READY && chunks.length > 0) {
      speakCurrentChunk(0, chunks, activeSettings, workingProfile);
    }
  }, [state]); // eslint-disable-line

  const progressPct = chunks.length > 0
    ? Math.round(((currentIndex + (state === DICTATION_STATES.COMPLETED ? 1 : 0)) / chunks.length) * 100)
    : 0;

  return {
    state,
    chunks,
    currentIndex,
    currentChunk: chunks[currentIndex] || null,
    chunkFeedback,
    activeSettings,
    workingProfile,
    progressPct,
    pauseStartTime,
    pauseEndTime,
    realtimeInsight,
    bufferState,
    startImmediately,
    isActive: state !== DICTATION_STATES.IDLE && state !== DICTATION_STATES.COMPLETED,

    startDictation,
    handleReady,
    handleReplay,
    handleSkip,
    handlePauseResume,
    handleStop,
    setActiveSettings,
  };
}
