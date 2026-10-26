// src/pages/Home.jsx
import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { useKokoroTTS } from '../hooks/useKokoroTTS';
import { useDictationEngine } from '../hooks/useDictationEngine';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useToast } from '../components/ui/Toast';
import { chunkText } from '../lib/textChunker';
import {
  calibrateFromManualRun,
  computeSessionProfileUpdate
} from '../lib/adaptiveAlgorithm';
import { DICTATION_STATES, DEFAULTS } from '../constants';

import Header from '../components/layout/Header';
import KeyboardHints from '../components/layout/KeyboardHints';
import TextInputArea from '../components/setup/TextInputArea';
import ControlsPanel from '../components/setup/ControlsPanel';
import ModelLoader from '../components/ModelLoader';
import DictationView from '../components/dictation/DictationView';
import SessionComplete from '../components/dictation/SessionComplete';
import CalibrationModal from '../components/calibration/CalibrationModal';
import ProfileModal from '../components/profile/ProfileModal';
import AuthModal from '../components/auth/AuthModal';

export default function Home() {
  const { user } = useAuth();
  const { profile, saveProfile, resetCalibration } = useProfile(user);
  const kokoroTTS = useKokoroTTS();
  const { addToast } = useToast();

  const [text, setText] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [sessionCompletedData, setSessionCompletedData] = useState(null);

  // Settings state (initialized from profile)
  const [settings, setSettings] = useState(() => ({
    mode: profile?.preferred_mode || DEFAULTS.MODE,
    voice: profile?.preferred_voice || DEFAULTS.VOICE,
    speakingSpeed: profile?.speaking_speed || DEFAULTS.SPEAKING_SPEED,
    pauseDuration: profile?.avg_pause_duration || DEFAULTS.PAUSE_DURATION,
  }));

  // Live dynamic chunking analysis for the current text
  const chunkAnalysis = useMemo(() => {
    if (!text.trim()) return null;
    return chunkText(text, { profile });
  }, [text, profile]);

  // Handle session complete callback
  const handleSessionFinished = useCallback(async ({
    chunks,
    feedback,
    settings: usedSettings,
    workingProfile,
    isCalibration,
  }) => {
    if (isCalibration) {
      const calibrated = calibrateFromManualRun(feedback);
      if (calibrated) {
        await saveProfile(calibrated);
        setSessionCompletedData({
          isCalibration: true,
          calibratedProfile: calibrated,
          totalChunks: chunks.length,
          replayCount: feedback.reduce((s, c) => s + (c.replay_count || 0), 0),
          changes: [
            { text: `Initial handwriting speed measured at ${calibrated.handwriting_wpm} WPM.` },
            { text: `Simple chunk capacity calibrated to ${calibrated.easy_chunk_capacity} words.` },
            { text: `Technical chunk capacity calibrated to ${calibrated.hard_chunk_capacity} words.` },
          ],
        });
        addToast(`Calibration complete: ${calibrated.handwriting_wpm} WPM!`, 'success');
      } else {
        addToast('Calibration finished using baseline handwriting profile.', 'info');
      }
    } else {
      const { updatedProfile, changes } = computeSessionProfileUpdate(workingProfile, feedback);
      await saveProfile(updatedProfile);

      setSessionCompletedData({
        isCalibration: false,
        totalChunks: chunks.length,
        totalWords: chunks.reduce((s, c) => s + c.wordCount, 0),
        replayCount: feedback.reduce((s, c) => s + (c.replay_count || 0), 0),
        changes,
      });

      addToast('Dictation complete! Profile updated.', 'success');
    }
  }, [saveProfile, addToast]);

  const dictation = useDictationEngine({
    tts: kokoroTTS,
    profile,
    saveProfile,
    onSessionComplete: handleSessionFinished,
  });

  // Start dictation
  const handleStart = () => {
    if (!text.trim()) {
      addToast('Please paste some text to dictate first!', 'error');
      return;
    }
    if (!kokoroTTS.isModelLoaded) {
      addToast('Kokoro neural engine is still loading… please wait', 'warning');
      return;
    }
    setSessionCompletedData(null);
    dictation.startDictation(text, settings, false);
  };

  // Start calibration run
  const handleStartCalibration = (sampleText) => {
    if (!kokoroTTS.isModelLoaded) {
      addToast('Kokoro neural engine is still loading… please wait', 'warning');
      return;
    }
    setSessionCompletedData(null);
    dictation.startDictation(sampleText, { ...settings, mode: 'manual' }, true);
  };

  // Skip calibration
  const handleSkipCalibration = () => {
    saveProfile({
      ...profile,
      is_calibrated: true,
      handwriting_wpm: 22,
    });
    setShowCalibrationModal(false);
    addToast('Set handwriting speed to smart baseline (22 WPM)', 'info');
  };

  // Keyboard shortcuts
  const isAnyModalOpen = showAuthModal || showProfileModal || showCalibrationModal;
  useKeyboardShortcuts({
    dictationState: dictation.state,
    handlers: {
      onReady: dictation.handleReady,
      onReplay: dictation.handleReplay,
      onSkip: dictation.handleSkip,
      onPauseResume: dictation.handlePauseResume,
      onStop: dictation.handleStop,
    },
    isModalOpen: isAnyModalOpen,
  });

  return (
    <>
      <div className={`page-wrapper ${!kokoroTTS.isModelLoaded ? 'page-disabled' : ''}`}>
        <Header
          profile={profile}
          onOpenProfile={() => setShowProfileModal(true)}
          onOpenAuth={() => setShowAuthModal(true)}
          onOpenCalibration={() => setShowCalibrationModal(true)}
        />

        <main className="main-content">
          {/* Hero Banner — always first so it's never occluded */}
          <div className="hero-section">
            <h1 className="hero-headline">
              Stop reading.{' '}
              <span className="hero-headline-accent">Just write.</span>
            </h1>
            <p className="hero-subtitle">
              Paste any text. ScribeSync dictates it chunk-by-chunk in a human Kokoro neural
              voice — adapting chunk length and pause duration to your natural writing speed.
            </p>
          </div>

          {/* First-time calibration banner */}
          {!profile.is_calibrated && dictation.state === DICTATION_STATES.IDLE && (
            <div className="calibration-banner animate-fadeInDown">
              <div className="calibration-banner-text">
                <h3>
                  <span>🎯</span> Calibrate Your Handwriting Rhythm
                </h3>
                <p>
                  Run a 60-second manual test so the AI knows how many words you comfortably write per breath.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowCalibrationModal(true)}
                >
                  ⚡ Calibrate Now
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleSkipCalibration}
                >
                  Use Smart Baseline
                </button>
              </div>
            </div>
          )}

          {/* Text Input Area with dynamic analysis */}
          <TextInputArea
            value={text}
            onChange={setText}
            disabled={dictation.isActive}
            chunkAnalysis={chunkAnalysis}
            profile={profile}
          />

          {/* Controls Panel */}
          <ControlsPanel
            settings={settings}
            onSettingsChange={setSettings}
            onStart={handleStart}
            canStart={text.trim().length > 0 && !dictation.isActive}
            kokoroTTS={kokoroTTS}
            profile={profile}
          />

          {/* Keyboard hints */}
          <KeyboardHints />
        </main>
      </div>

      {/* Active Dictation Overlay */}
      {dictation.isActive && !sessionCompletedData && (
        <DictationView
          state={dictation.state}
          currentChunk={dictation.currentChunk}
          currentIndex={dictation.currentIndex}
          totalChunks={dictation.chunks.length}
          progressPct={dictation.progressPct}
          pauseStartTime={dictation.pauseStartTime}
          pauseEndTime={dictation.pauseEndTime}
          realtimeInsight={dictation.realtimeInsight}
          isCalibration={sessionCompletedData?.isCalibration}
          bufferState={dictation.bufferState}
          onStartImmediately={dictation.startImmediately}
          onReady={dictation.handleReady}
          onReplay={dictation.handleReplay}
          onSkip={dictation.handleSkip}
          onPauseResume={dictation.handlePauseResume}
          onStop={dictation.handleStop}
        />
      )}

      {/* Session Complete Modal */}
      {sessionCompletedData && (
        <SessionComplete
          stats={sessionCompletedData}
          isCalibration={sessionCompletedData.isCalibration}
          calibratedProfile={sessionCompletedData.calibratedProfile}
          onStartWithAI={() => {
            setSessionCompletedData(null);
            dictation.handleStop();
            setSettings(prev => ({ ...prev, mode: 'adaptive' }));
            addToast('AI Mode active with your calibrated pace!', 'success');
          }}
          onRestart={() => {
            setSessionCompletedData(null);
            dictation.handleStop();
            handleStart();
          }}
          onClose={() => {
            setSessionCompletedData(null);
            dictation.handleStop();
          }}
        />
      )}

      {/* Calibration Modal */}
      <CalibrationModal
        isOpen={showCalibrationModal}
        onClose={() => setShowCalibrationModal(false)}
        onStartCalibration={handleStartCalibration}
        onSkipCalibration={handleSkipCalibration}
      />

      {/* Profile Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        profile={profile}
        onRecalibrate={() => setShowCalibrationModal(true)}
        onResetCalibration={() => {
          resetCalibration();
          addToast('Profile reset to standard adult baseline', 'info');
        }}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={(msg) => addToast(msg, 'success')}
      />

      {/* Fullscreen blocking loader until Kokoro is loaded */}
      {!kokoroTTS.isModelLoaded && (
        <ModelLoader
          progress={kokoroTTS.loadProgress}
          loadingMessage={kokoroTTS.loadingMessage}
          error={kokoroTTS.error}
          onRetry={kokoroTTS.loadModel}
        />
      )}
    </>
  );
}
