// src/hooks/useSpeechEngine.js
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  speakText,
  stopSpeaking,
  subscribeToVoices,
  getAvailableVoices
} from '../lib/speechEngine';

export function useSpeechEngine() {
  const [voices, setVoices] = useState(getAvailableVoices());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const cancelRef = useRef(null);

  useEffect(() => {
    const unsubscribe = subscribeToVoices((updatedVoices) => {
      setVoices(updatedVoices);
    });
    return () => unsubscribe();
  }, []);

  const speak = useCallback((text, options = {}) => {
    if (cancelRef.current) {
      cancelRef.current();
    }

    setIsSpeaking(true);

    const cancel = speakText(text, {
      ...options,
      onStart: () => {
        setIsSpeaking(true);
        options.onStart?.();
      },
      onEnd: () => {
        setIsSpeaking(false);
        options.onEnd?.();
      },
      onError: (err) => {
        setIsSpeaking(false);
        options.onError?.(err);
      },
    });

    cancelRef.current = cancel;
    return cancel;
  }, []);

  const stop = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
    }
    stopSpeaking();
    setIsSpeaking(false);
  }, []);

  const testVoice = useCallback((voiceId, speed = 1.0) => {
    stop();
    speak('ScribeSync ready. Write comfortably as I read to you.', {
      voiceId,
      rate: speed,
    });
  }, [stop, speak]);

  return {
    voices,
    isSpeaking,
    speak,
    stop,
    testVoice,
  };
}
