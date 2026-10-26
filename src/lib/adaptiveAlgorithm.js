// src/lib/adaptiveAlgorithm.js
import { ADAPTIVE, DEFAULTS, LIMITS } from '../constants';

/**
 * Calibrates a brand-new user profile from an interactive Manual Run.
 * User listens to chunks, writes on paper, and presses Space/Ready when finished.
 */
export function calibrateFromManualRun(calibrationChunksFeedback) {
  if (!calibrationChunksFeedback || calibrationChunksFeedback.length === 0) {
    return null;
  }

  const validChunks = calibrationChunksFeedback.filter(c => c.readyTimeMs != null && c.readyTimeMs > 500);
  if (validChunks.length === 0) return null;

  // Categorize by difficulty
  const easyChunks = validChunks.filter(c => c.difficulty === 'easy');
  const hardChunks = validChunks.filter(c => c.difficulty === 'hard');
  const mediumChunks = validChunks.filter(c => c.difficulty === 'medium');

  // Compute character stroke speed
  const totalChars = validChunks.reduce((sum, c) => sum + (c.charCount || c.text.length), 0);
  const totalMs = validChunks.reduce((sum, c) => sum + c.readyTimeMs, 0);
  const avgMsPerChar = Math.round(Math.max(220, Math.min(650, totalMs / (totalChars || 1))));

  // Estimated Words Per Minute (standard 5 chars per word)
  const handwritingWpm = Math.round(Math.max(LIMITS.MIN_WPM, Math.min(LIMITS.MAX_WPM, 60000 / (avgMsPerChar * 5))));

  // Complexity sensitivity
  let easyMsPerChar = avgMsPerChar;
  if (easyChunks.length > 0) {
    const easyChars = easyChunks.reduce((s, c) => s + c.charCount, 0);
    const easyMs = easyChunks.reduce((s, c) => s + c.readyTimeMs, 0);
    easyMsPerChar = easyMs / (easyChars || 1);
  }

  let hardMsPerChar = avgMsPerChar;
  if (hardChunks.length > 0) {
    const hardChars = hardChunks.reduce((s, c) => s + c.charCount, 0);
    const hardMs = hardChunks.reduce((s, c) => s + c.readyTimeMs, 0);
    hardMsPerChar = hardMs / (hardChars || 1);
  }

  const complexitySensitivity = Number(Math.max(1.1, Math.min(2.2, hardMsPerChar / (easyMsPerChar || 1))).toFixed(2));

  // Determine personalized chunk capacities
  const totalReplays = validChunks.reduce((sum, c) => sum + (c.replayCount || 0), 0);
  let easyCap = DEFAULTS.EASY_CHUNK_CAPACITY;
  let medCap = DEFAULTS.MEDIUM_CHUNK_CAPACITY;
  let hardCap = DEFAULTS.HARD_CHUNK_CAPACITY;

  // Faster writers can hold larger chunks
  if (handwritingWpm >= 26) {
    easyCap = 7;
    medCap = 5;
    hardCap = 3.5;
  } else if (handwritingWpm <= 16) {
    easyCap = 4.5;
    medCap = 3.5;
    hardCap = 2;
  }

  // If hard chunks were replayed, scale hard capacity down
  const hardReplays = hardChunks.reduce((s, c) => s + (c.replayCount || 0), 0);
  if (hardReplays > 0) {
    hardCap = Math.max(LIMITS.MIN_WORDS_PER_CHUNK, hardCap - 0.5);
  }

  const calibratedProfile = {
    is_calibrated: true,
    handwriting_wpm: handwritingWpm,
    ms_per_char: avgMsPerChar,
    complexity_sensitivity: complexitySensitivity,
    easy_chunk_capacity: Number(easyCap.toFixed(1)),
    medium_chunk_capacity: Number(medCap.toFixed(1)),
    hard_chunk_capacity: Number(hardCap.toFixed(1)),
    avg_pause_duration: Number((Math.max(2.0, (avgMsPerChar * 25) / 1000)).toFixed(1)),
    speaking_speed: 1.0,
    preferred_mode: 'adaptive',
    total_sessions: 1,
    total_calibration_chunks: validChunks.length,
    calibrated_at: new Date().toISOString(),
  };

  return calibratedProfile;
}

/**
 * Real-time dynamic adaptation on user events (Replay, Early Ready, Pause).
 * Updates working parameters and generates explainable AI insights.
 */
export function handleRealTimeFeedback(event, chunk, currentProfile) {
  const profile = { ...currentProfile };
  const insights = [];

  if (event === 'replay') {
    // Replay requested: Chunk was too complex or pause was too short
    if (chunk.difficulty === 'hard') {
      profile.hard_chunk_capacity = Math.max(
        LIMITS.MIN_WORDS_PER_CHUNK,
        round1((profile.hard_chunk_capacity || DEFAULTS.HARD_CHUNK_CAPACITY) - 0.4)
      );
      insights.push(`Replay on technical chunk: reduced technical chunk target to ${profile.hard_chunk_capacity} words and expanded pause buffer.`);
    } else if (chunk.difficulty === 'medium') {
      profile.medium_chunk_capacity = Math.max(
        LIMITS.MIN_WORDS_PER_CHUNK,
        round1((profile.medium_chunk_capacity || DEFAULTS.MEDIUM_CHUNK_CAPACITY) - 0.3)
      );
      insights.push(`Replay on moderate chunk: reduced chunk target to ${profile.medium_chunk_capacity} words.`);
    } else {
      profile.easy_chunk_capacity = Math.max(
        LIMITS.MIN_WORDS_PER_CHUNK,
        round1((profile.easy_chunk_capacity || DEFAULTS.EASY_CHUNK_CAPACITY) - 0.5)
      );
      insights.push(`Replay on simple chunk: shrunk chunk size to ${profile.easy_chunk_capacity} words.`);
    }

    // Add extra pause padding
    profile.avg_pause_duration = Math.min(
      LIMITS.MAX_PAUSE,
      round1((profile.avg_pause_duration || DEFAULTS.PAUSE_DURATION) + ADAPTIVE.REPLAY_PAUSE_EXPANSION)
    );
  } else if (event === 'early_ready') {
    // User pressed Ready before pause finished
    profile.avg_pause_duration = Math.max(
      LIMITS.MIN_PAUSE,
      round1((profile.avg_pause_duration || DEFAULTS.PAUSE_DURATION) - ADAPTIVE.EARLY_READY_TRIM)
    );

    // If on easy text and consistently early, slightly expand easy capacity
    if (chunk.difficulty === 'easy') {
      profile.easy_chunk_capacity = Math.min(
        LIMITS.MAX_WORDS_PER_CHUNK,
        round1((profile.easy_chunk_capacity || DEFAULTS.EASY_CHUNK_CAPACITY) + 0.15)
      );
    }

    insights.push(`Writing faster than baseline: trimmed pause timing (-${ADAPTIVE.EARLY_READY_TRIM}s).`);
  } else if (event === 'late_ready') {
    // User needed more time
    profile.avg_pause_duration = Math.min(
      LIMITS.MAX_PAUSE,
      round1((profile.avg_pause_duration || DEFAULTS.PAUSE_DURATION) + ADAPTIVE.LATE_READY_EXPAND)
    );
    insights.push(`Extended writing time needed: increased pause buffer (+${ADAPTIVE.LATE_READY_EXPAND}s).`);
  }

  return {
    updatedProfile: profile,
    insights,
  };
}

/**
 * Consolidates session statistics into the long-term pacing profile.
 */
export function computeSessionProfileUpdate(profile, chunkFeedbackList) {
  if (!chunkFeedbackList || chunkFeedbackList.length === 0) {
    return { updatedProfile: profile, changes: [] };
  }

  const α = ADAPTIVE.LEARNING_RATE;
  const changes = [];

  const completed = chunkFeedbackList.filter(c => c.ready_time_ms != null);
  const totalChunks = chunkFeedbackList.length;
  const totalReplays = chunkFeedbackList.reduce((s, c) => s + (c.replay_count || 0), 0);
  const replayRate = totalChunks > 0 ? totalReplays / totalChunks : 0;

  // Calculate actual writing rate this session
  if (completed.length > 0) {
    const totalChars = completed.reduce((s, c) => s + (c.char_count || c.chunk_text.length), 0);
    const totalMs = completed.reduce((s, c) => s + c.ready_time_ms, 0);
    const sessionMsPerChar = Math.round(totalMs / (totalChars || 1));

    const oldMsPerChar = profile.ms_per_char || DEFAULTS.MS_PER_CHAR;
    const newMsPerChar = Math.round((1 - α) * oldMsPerChar + α * sessionMsPerChar);
    const newWpm = Math.round(60000 / (newMsPerChar * 5));

    if (Math.abs(newWpm - (profile.handwriting_wpm || DEFAULTS.HANDWRITING_WPM)) >= 1) {
      changes.push({
        type: 'speed',
        text: `Handwriting pace updated to ${newWpm} WPM (was ${profile.handwriting_wpm || DEFAULTS.HANDWRITING_WPM} WPM).`,
      });
    }

    profile.ms_per_char = newMsPerChar;
    profile.handwriting_wpm = newWpm;
  }

  // Adjust capacities based on replay rates per category
  const hardChunks = chunkFeedbackList.filter(c => c.difficulty === 'hard');
  const hardReplays = hardChunks.reduce((s, c) => s + (c.replay_count || 0), 0);
  if (hardChunks.length > 0 && hardReplays / hardChunks.length > 0.3) {
    profile.hard_chunk_capacity = Math.max(
      LIMITS.MIN_WORDS_PER_CHUNK,
      round1((profile.hard_chunk_capacity || DEFAULTS.HARD_CHUNK_CAPACITY) - 0.4)
    );
    changes.push({
      type: 'chunk_hard',
      text: `Technical phrases had high replays: shrunk technical chunk size to ${profile.hard_chunk_capacity} words.`,
    });
  }

  const easyChunks = chunkFeedbackList.filter(c => c.difficulty === 'easy');
  const easyReplays = easyChunks.reduce((s, c) => s + (c.replay_count || 0), 0);
  if (easyChunks.length > 0 && easyReplays === 0) {
    profile.easy_chunk_capacity = Math.min(
      LIMITS.MAX_WORDS_PER_CHUNK,
      round1((profile.easy_chunk_capacity || DEFAULTS.EASY_CHUNK_CAPACITY) + 0.2)
    );
    changes.push({
      type: 'chunk_easy',
      text: `Simple phrases written smoothly: increased simple chunk capacity to ${profile.easy_chunk_capacity} words.`,
    });
  }

  const totalWordsPracticed = chunkFeedbackList.reduce((s, c) => s + (c.chunk_word_count || 0), 0);

  const updatedProfile = {
    ...profile,
    total_sessions: (profile.total_sessions || 0) + 1,
    total_chunks_practiced: (profile.total_chunks_practiced || 0) + totalChunks,
    total_words_practiced: (profile.total_words_practiced || 0) + totalWordsPracticed,
    replay_rate: Number(((1 - α) * (profile.replay_rate || 0) + α * replayRate).toFixed(2)),
    updated_at: new Date().toISOString(),
  };

  return { updatedProfile, changes };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
