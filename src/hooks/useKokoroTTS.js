// src/hooks/useKokoroTTS.js
import { useState, useRef, useCallback, useEffect } from 'react';
import { speakText, stopSpeaking } from '../lib/speechEngine';
import { KOKORO_VOICES } from '../constants';
import TTSWorker from '../workers/tts.worker.js?worker';

export function useKokoroTTS() {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [status, setStatus] = useState('loading');
  const [loadProgress, setLoadProgress] = useState(10);
  const [error, setError] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('Initializing neural engine in background...');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const workerRef = useRef(null);
  const pendingRequestsRef = useRef(new Map());
  const requestIdCounterRef = useRef(0);
  const activeSourceRef = useRef(null);
  const currentGenIdRef = useRef(0);
  const isMountedRef = useRef(true);

  // In-memory audio Blob cache: `${text}_${voice}_${rate}` -> Blob
  const audioCacheRef = useRef(new Map());
  const inFlightPromisesRef = useRef(new Map());

  // Instantiate or retrieve the background Web Worker
  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      try {
        const worker = new TTSWorker();

        worker.onmessage = (e) => {
          if (!isMountedRef.current) return;
          const { type, id, payload, data, error: workerErr } = e.data || {};

          if (type === 'INIT_PROGRESS') {
            if (data?.pct) setLoadProgress(data.pct);
            if (data?.file) {
              setLoadingMessage(`Downloading ${data.file} (${data.pct}%)...`);
            }
          } else if (type === 'INIT_SUCCESS') {
            setLoadProgress(100);
            setLoadingMessage('Kokoro Neural Engine Ready!');
            setIsModelLoaded(true);
            setStatus('ready');
          } else if (type === 'INIT_ERROR') {
            console.error('[KokoroTTS Worker] Init error:', workerErr);
            setError(workerErr || 'Failed to initialize neural worker');
            setStatus('error');
          } else if (type === 'GENERATE_SUCCESS') {
            const entry = pendingRequestsRef.current.get(id);
            if (entry) {
              pendingRequestsRef.current.delete(id);
              const blob = new Blob([payload.wavBuffer], { type: 'audio/wav' });
              entry.resolve(blob);
            }
          } else if (type === 'GENERATE_ERROR') {
            const entry = pendingRequestsRef.current.get(id);
            if (entry) {
              pendingRequestsRef.current.delete(id);
              entry.reject(new Error(workerErr || 'Audio generation error in worker'));
            }
          }
        };

        worker.onerror = (err) => {
          console.error('[KokoroTTS Worker] Unhandled worker error:', err);
        };

        workerRef.current = worker;
      } catch (err) {
        console.error('[KokoroTTS] Failed to construct Web Worker:', err);
      }
    }
    return workerRef.current;
  }, []);

  const loadModel = useCallback(() => {
    setStatus('loading');
    setIsModelLoaded(false);
    setLoadProgress(15);
    setError(null);
    setLoadingMessage('Starting background neural worker (60 FPS)...');

    const worker = getWorker();
    if (!worker) {
      setError('Web Worker initialization failed');
      setStatus('error');
      return;
    }

    worker.postMessage({ type: 'INIT' });
  }, [getWorker]);

  useEffect(() => {
    isMountedRef.current = true;
    loadModel();
    return () => {
      isMountedRef.current = false;
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [loadModel]);

  // Generate audio via Web Worker (off the main thread) and cache the resulting Blob
  const generateAudioBlob = useCallback(async (text, voice, rate) => {
    const cacheKey = `${text}_${voice}_${rate}`;

    // 1. Instant return if already cached
    if (audioCacheRef.current.has(cacheKey)) {
      return audioCacheRef.current.get(cacheKey);
    }

    // 2. Return in-flight request if already being synthesized
    if (inFlightPromisesRef.current.has(cacheKey)) {
      return await inFlightPromisesRef.current.get(cacheKey);
    }

    const worker = getWorker();
    if (!worker) throw new Error('Worker unavailable');

    const promise = new Promise((resolve, reject) => {
      const reqId = ++requestIdCounterRef.current;
      pendingRequestsRef.current.set(reqId, {
        resolve: (blob) => {
          audioCacheRef.current.set(cacheKey, blob);
          resolve(blob);
        },
        reject,
      });

      worker.postMessage({
        type: 'GENERATE',
        id: reqId,
        payload: { text, voice, speed: rate },
      });
    });

    inFlightPromisesRef.current.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      inFlightPromisesRef.current.delete(cacheKey);
    }
  }, [getWorker]);

  // Check if text audio is already cached in memory
  const isCached = useCallback((text, { voice = 'af_heart', rate = 1.0 } = {}) => {
    if (!text) return false;
    const cacheKey = `${text}_${voice}_${rate}`;
    return audioCacheRef.current.has(cacheKey);
  }, []);

  // Preload chunk audio in background worker without blocking main UI
  const preload = useCallback(async (text, { voice = 'af_heart', rate = 1.0 } = {}) => {
    if (!text || voice === '__fallback__' || !isModelLoaded) return null;
    try {
      return await generateAudioBlob(text, voice, rate);
    } catch (err) {
      console.warn('[KokoroTTS Worker] Preload notice:', err);
      return null;
    }
  }, [isModelLoaded, generateAudioBlob]);

  const cancel = useCallback(() => {
    currentGenIdRef.current += 1;
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.pause();
        activeSourceRef.current.src = '';
      } catch (e) {}
      activeSourceRef.current = null;
    }
    stopSpeaking();
    setIsSpeaking(false);
    if (status === 'speaking') {
      setStatus('ready');
    }
  }, [status]);

  const speak = useCallback(async (text, {
    voice = 'af_heart',
    rate = 1.0,
    onStart,
    onEnd,
    onError,
  } = {}) => {
    if (!text || !text.trim()) return;
    cancel();

    const genId = currentGenIdRef.current;

    // Clean text of markdown/LaTeX formatting tokens before synthesis
    const cleanText = text
      .replace(/[*_~`#|]/g, ' ')
      .replace(/\\\[|\\\]|\\\(|\\\)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Fallback to browser speech synthesis
    if (voice === '__fallback__' || !isModelLoaded) {
      setIsSpeaking(true);
      setStatus('speaking');
      speakText(cleanText || text, {
        voiceId: 'auto-natural',
        rate,
        onStart: () => {
          if (genId !== currentGenIdRef.current) return;
          const estimatedDur = Math.max(1.5, (cleanText || text).split(/\s+/).length / (2.5 * rate));
          onStart?.({ duration: estimatedDur });
        },
        onEnd: () => {
          if (genId !== currentGenIdRef.current) return;
          setIsSpeaking(false);
          setStatus('ready');
          onEnd?.();
        },
        onError: (err) => {
          if (genId !== currentGenIdRef.current) return;
          setIsSpeaking(false);
          setStatus('ready');
          onError?.(err);
        },
      });
      return;
    }

    setIsSpeaking(true);
    setStatus('speaking');

    try {
      // Pull from cache instantly or request from worker
      const blob = await generateAudioBlob(cleanText || text, voice, rate);

      // Verify request is still active and was not cancelled
      if (genId !== currentGenIdRef.current) return;

      if (activeSourceRef.current) {
        try {
          activeSourceRef.current.pause();
          activeSourceRef.current.src = '';
        } catch (e) {}
        activeSourceRef.current = null;
      }

      const url = URL.createObjectURL(blob);
      const audioObj = new Audio(url);
      activeSourceRef.current = audioObj;

      let startedFired = false;
      const fireStart = () => {
        if (!startedFired && genId === currentGenIdRef.current) {
          startedFired = true;
          const dur = audioObj.duration && !isNaN(audioObj.duration) && isFinite(audioObj.duration) && audioObj.duration > 0
            ? audioObj.duration
            : Math.max(1.5, (cleanText || text).split(/\s+/).length / (2.5 * rate));
          onStart?.({ duration: dur });
        }
      };

      audioObj.onplay = () => {
        fireStart();
      };

      audioObj.onended = () => {
        if (activeSourceRef.current === audioObj) {
          activeSourceRef.current = null;
          try {
            URL.revokeObjectURL(url);
          } catch (e) {}
          setIsSpeaking(false);
          setStatus('ready');
          if (genId === currentGenIdRef.current) {
            onEnd?.();
          }
        }
      };

      audioObj.onerror = (e) => {
        // Critical: Never trigger fallback if request was cancelled or superseded!
        if (genId !== currentGenIdRef.current) return;

        console.warn('[KokoroTTS] Audio playback error:', e);
        if (activeSourceRef.current === audioObj) {
          activeSourceRef.current = null;
        }
        try {
          URL.revokeObjectURL(url);
        } catch (err) {}

        if (genId === currentGenIdRef.current) {
          speakText(cleanText || text, {
            voiceId: 'auto-natural',
            rate,
            onStart: () => {
              if (genId !== currentGenIdRef.current) return;
              fireStart();
            },
            onEnd: () => {
              if (genId !== currentGenIdRef.current) return;
              setIsSpeaking(false);
              setStatus('ready');
              onEnd?.();
            },
            onError: (speechErr) => {
              if (genId !== currentGenIdRef.current) return;
              setIsSpeaking(false);
              setStatus('ready');
              onError?.(speechErr);
            },
          });
        }
      };

      try {
        await audioObj.play();
        fireStart();
      } catch (playErr) {
        if (genId !== currentGenIdRef.current) return;
        console.warn('[KokoroTTS] audioObj.play() caught exception:', playErr);
        audioObj.onerror(playErr);
      }

    } catch (err) {
      // Critical: Never trigger fallback if request was cancelled or superseded!
      if (genId !== currentGenIdRef.current) return;

      console.error('[KokoroTTS] Worker audio generation error, falling back:', err);
      speakText(cleanText || text, {
        voiceId: 'auto-natural',
        rate,
        onStart: () => {
          if (genId !== currentGenIdRef.current) return;
          const dur = Math.max(1.5, (cleanText || text).split(/\s+/).length / (2.5 * rate));
          onStart?.({ duration: dur });
        },
        onEnd: () => {
          if (genId !== currentGenIdRef.current) return;
          setIsSpeaking(false);
          setStatus('ready');
          onEnd?.();
        },
        onError: (speechErr) => {
          if (genId !== currentGenIdRef.current) return;
          setIsSpeaking(false);
          setStatus('ready');
          onError?.(speechErr);
        },
      });
    }
  }, [cancel, isModelLoaded, generateAudioBlob]);

  const testVoice = useCallback((voiceId, speed = 1.0) => {
    cancel();
    speak('ScribeSync Kokoro neural voice verified. Ready to dictate while you write.', {
      voice: voiceId,
      rate: speed,
      onEnd: () => setIsSpeaking(false),
    });
  }, [cancel, speak]);

  return {
    status,
    loadProgress,
    loadingMessage,
    error,
    isModelLoaded,
    isReady: isModelLoaded && status !== 'error' && status !== 'loading',
    isLoading: status === 'loading',
    isSpeaking,
    voices: KOKORO_VOICES,
    loadModel,
    preload,
    isCached,
    speak,
    cancel,
    testVoice,
  };
}
