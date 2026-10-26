// src/hooks/useKeyboardShortcuts.js
import { useEffect } from 'react';
import { KEYBOARD_SHORTCUTS, DICTATION_STATES } from '../constants';

export function useKeyboardShortcuts({
  dictationState,
  handlers,
  isModalOpen = false,
}) {
  useEffect(() => {
    if (isModalOpen) return;

    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName;
      const isInput = activeTag === 'INPUT' || activeTag === 'TEXTAREA';

      // If user is actively typing in the textarea/input, don't trigger dictation shortcuts
      if (isInput) return;

      const isActive =
        dictationState !== DICTATION_STATES.IDLE &&
        dictationState !== DICTATION_STATES.COMPLETED;

      if (!isActive) return;

      if (e.key === KEYBOARD_SHORTCUTS.READY) {
        e.preventDefault();
        handlers.onReady?.();
      } else if (e.key.toLowerCase() === KEYBOARD_SHORTCUTS.REPLAY) {
        e.preventDefault();
        handlers.onReplay?.();
      } else if (e.key === KEYBOARD_SHORTCUTS.SKIP) {
        e.preventDefault();
        handlers.onSkip?.();
      } else if (e.key.toLowerCase() === KEYBOARD_SHORTCUTS.PAUSE_RESUME) {
        e.preventDefault();
        handlers.onPauseResume?.();
      } else if (e.key === KEYBOARD_SHORTCUTS.RESTART) {
        e.preventDefault();
        handlers.onStop?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dictationState, handlers, isModalOpen]);
}
