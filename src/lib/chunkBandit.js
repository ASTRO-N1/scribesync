// src/lib/chunkBandit.js
/**
 * ============================================================
 *  MACHINE LEARNING ALGORITHM #2
 *  Multi-Armed Bandit — Upper Confidence Bound (UCB1)
 * ============================================================
 *
 * PURPOSE:
 *   Discovers the optimal chunk word-count for each difficulty tier
 *   (easy / medium / hard) through reinforcement-style trial-and-error,
 *   without needing labelled training data.
 *
 * THE EXPLORATION-EXPLOITATION DILEMMA:
 *   - We have a set of possible chunk sizes (ARMS): {2, 3, 4, 5, 6, 7} words.
 *   - For each difficulty tier, the bandit must find which arm gives the
 *     best user experience (fewest replays, smoothest timing).
 *   - Too small → user is bored / writes too fast → waste of time.
 *   - Too large → user's working memory overflows → Replay pressed → bad.
 *   - The bandit balances EXPLOITATION (use the best known arm) with
 *     EXPLORATION (try arms we haven't tested much to find better ones).
 *
 * ALGORITHM: UCB1 (Upper Confidence Bound)
 *   UCB1 selects the arm a* that maximizes:
 *
 *     a* = argmax_a [ Q(a) + C * sqrt( ln(N) / n(a) ) ]
 *
 *   Where:
 *     Q(a)   = estimated average reward for arm a (higher = better experience)
 *     N      = total number of trials across all arms for this tier
 *     n(a)   = number of times arm a has been pulled
 *     C      = exploration constant (default 1.0)
 *
 *   The second term is the CONFIDENCE BONUS — it is large when an arm
 *   has been tried few times (uncertainty → explore) and shrinks as
 *   we gather more data (certainty → exploit the best arm).
 *
 * REWARD FUNCTION:
 *   After each chunk completes:
 *     R = +1.0   if completed smoothly (no replay, timer ended naturally)
 *     R = +0.4   if user pressed Space early (they were fast — chunk was OK)
 *     R = -1.0   if Replay was pressed (chunk overloaded working memory!)
 *     R = -0.3   if the user was very late (>130% of predicted time)
 *
 * ARMS (possible chunk sizes):
 *   [2, 3, 4, 5, 6, 7] word targets (integers).
 *   Each difficulty tier (easy/medium/hard) has its own independent bandit
 *   because optimal sizes differ significantly between difficulty levels.
 *
 * PERSISTENCE:
 *   The Q-values and arm pull counts are stored in the user's profile
 *   (localStorage + Supabase) so the bandit improves across sessions.
 */

export const BANDIT_ARMS = [2, 3, 4, 5, 6, 7]; // possible word counts per chunk
const EXPLORATION_CONSTANT = 1.2; // C in UCB1 formula
const DIFFICULTY_TIERS = ['easy', 'medium', 'hard'];

/**
 * Creates a brand-new bandit state for all three difficulty tiers.
 * Each arm starts with Q=0, n=0 (no experience yet).
 * On first pull, each arm gets one exploratory trial before UCB takes over.
 *
 * @returns {object} banditState
 */
export function createInitialBanditState() {
  const state = {};
  for (const tier of DIFFICULTY_TIERS) {
    state[tier] = {
      // Q(a): estimated average reward for each arm
      qValues: Object.fromEntries(BANDIT_ARMS.map(a => [a, 0.0])),
      // n(a): number of times each arm has been pulled
      pullCounts: Object.fromEntries(BANDIT_ARMS.map(a => [a, 0])),
      // N: total pulls for this tier
      totalPulls: 0,
    };
  }
  return state;
}

/**
 * Loads bandit state from the user's profile (persisted).
 * Falls back to initial state if not yet trained.
 *
 * @param {object} profile
 * @returns {object} banditState
 */
export function loadBanditState(profile) {
  if (profile?.bandit_state && typeof profile.bandit_state === 'object') {
    // Validate structure before using
    const bs = profile.bandit_state;
    const isValid = DIFFICULTY_TIERS.every(tier =>
      bs[tier] &&
      bs[tier].qValues &&
      bs[tier].pullCounts &&
      typeof bs[tier].totalPulls === 'number'
    );
    if (isValid) return deepCloneBanditState(bs);
  }
  return createInitialBanditState();
}

/**
 * UCB1 arm selection for a given difficulty tier.
 * Returns the optimal chunk word count the bandit recommends.
 *
 * UCB1 formula: a* = argmax_a [ Q(a) + C * sqrt(ln(N) / n(a)) ]
 *
 * Special case: if any arm has never been pulled (n(a) = 0),
 * it is guaranteed to be selected first (infinite UCB bonus).
 * This ensures all arms are tried at least once before exploitation begins.
 *
 * @param {object} banditState - full state for all tiers
 * @param {string} difficulty  - 'easy' | 'medium' | 'hard'
 * @returns {number} selected arm (word count)
 */
export function selectArm(banditState, difficulty) {
  const tier = banditState[difficulty] || banditState['medium'];
  const N = tier.totalPulls;

  // Phase 1: Force exploration of all arms at least once (round-robin)
  for (const arm of BANDIT_ARMS) {
    if (tier.pullCounts[arm] === 0) return arm;
  }

  // Phase 2: UCB1 selection
  let bestArm = BANDIT_ARMS[0];
  let bestUCB = -Infinity;

  for (const arm of BANDIT_ARMS) {
    const n = tier.pullCounts[arm];
    const q = tier.qValues[arm];
    // UCB1: exploitation term Q(a) + exploration bonus C*sqrt(ln(N)/n(a))
    const confidenceBonus = EXPLORATION_CONSTANT * Math.sqrt(Math.log(N) / n);
    const ucbValue = q + confidenceBonus;

    if (ucbValue > bestUCB) {
      bestUCB = ucbValue;
      bestArm = arm;
    }
  }

  return bestArm;
}

/**
 * Updates the bandit Q-value for an arm after observing a reward.
 * Uses incremental online average update:
 *
 *   Q(a) ← Q(a) + (1/n(a)) * (R - Q(a))
 *
 * This is mathematically equivalent to a running arithmetic mean
 * and does not require storing all historical rewards.
 *
 * @param {object} banditState - current state (will be deep-cloned)
 * @param {string} difficulty  - 'easy' | 'medium' | 'hard'
 * @param {number} chosenArm   - the arm that was pulled (word count used)
 * @param {number} reward      - observed reward R ∈ [-1.0, +1.0]
 * @returns {{ newState: object, insight: string }}
 */
export function updateBandit(banditState, difficulty, chosenArm, reward) {
  const newState = deepCloneBanditState(banditState);
  const tier = newState[difficulty];

  tier.pullCounts[chosenArm] = (tier.pullCounts[chosenArm] || 0) + 1;
  tier.totalPulls = (tier.totalPulls || 0) + 1;

  const n = tier.pullCounts[chosenArm];
  const oldQ = tier.qValues[chosenArm] || 0;

  // Incremental mean update: Q(a) ← Q(a) + (1/n) * (R - Q(a))
  tier.qValues[chosenArm] = oldQ + (1 / n) * (reward - oldQ);

  // Build an explainable insight string
  const sign = reward >= 0 ? '+' : '';
  const insight = `Bandit(${difficulty}): arm=${chosenArm}w → reward=${sign}${reward.toFixed(2)}, Q=${tier.qValues[chosenArm].toFixed(3)} after ${n} pulls.`;

  return { newState, insight };
}

/**
 * Computes the reward signal from chunk completion feedback.
 * This is the bridge between the user's behaviour and the RL signal.
 *
 * @param {object} feedbackItem - from chunkFeedback array in useDictationEngine
 * @param {number} predictedMs  - what the SGD model predicted for this chunk
 * @returns {number} reward R ∈ [-1.0, +1.0]
 */
export function computeReward(feedbackItem, predictedMs) {
  const { replay_count = 0, ready_time_ms, pause_duration_used } = feedbackItem;
  const expectedMs = (pause_duration_used || 3.2) * 1000;

  // Replay: strong negative signal — chunk was too hard / too long
  if (replay_count > 0) {
    return -1.0 * Math.min(replay_count, 2); // up to -2.0 for multiple replays
  }

  if (!ready_time_ms) return 0.0; // incomplete data, neutral

  const ratio = ready_time_ms / expectedMs;

  if (ratio < 0.65) {
    // Early ready: user finished writing well before expected → chunk was manageable
    return +0.6;
  } else if (ratio <= 1.05) {
    // On-time: near-perfect timing calibration
    return +1.0;
  } else if (ratio <= 1.30) {
    // Slightly late: chunk was a bit too large but manageable
    return +0.2;
  } else {
    // Very late: chunk was too big for this user at this difficulty
    return -0.4;
  }
}

/**
 * Serializes bandit state back into the profile for persistence.
 *
 * @param {object} profile
 * @param {object} banditState
 * @returns {object} updated profile
 */
export function serializeBanditToProfile(profile, banditState) {
  return {
    ...profile,
    bandit_state: banditState,
  };
}

/**
 * Returns a human-readable debug summary of the bandit's current beliefs.
 * Useful for the Session Complete screen "AI Insights" section.
 *
 * @param {object} banditState
 * @returns {object[]} array of { tier, bestArm, bestQ, totalPulls }
 */
export function getBanditSummary(banditState) {
  return DIFFICULTY_TIERS.map(tier => {
    const s = banditState[tier];
    let bestArm = BANDIT_ARMS[0];
    let bestQ = -Infinity;
    for (const arm of BANDIT_ARMS) {
      if ((s.qValues[arm] || 0) > bestQ) {
        bestQ = s.qValues[arm] || 0;
        bestArm = arm;
      }
    }
    return {
      tier,
      bestArm,
      bestQ: Number(bestQ.toFixed(3)),
      totalPulls: s.totalPulls,
    };
  });
}

// Deep clone to avoid accidental mutation of state references
function deepCloneBanditState(state) {
  return JSON.parse(JSON.stringify(state));
}
