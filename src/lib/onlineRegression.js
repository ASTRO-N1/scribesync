// src/lib/onlineRegression.js
/**
 * ============================================================
 *  MACHINE LEARNING ALGORITHM #1
 *  Online Stochastic Gradient Descent (SGD) Linear Regression
 * ============================================================
 *
 * PURPOSE:
 *   Predicts how long (in milliseconds) it will actually take a specific
 *   user to write down a given text chunk, based on measurable text features.
 *   This replaces the hardcoded formula with a model that LEARNS from the
 *   user's actual observed writing latency after every single chunk.
 *
 * MODEL:
 *   ŷ = w · x + b
 *   where ŷ = predicted writing time (ms), x = feature vector, w = weights, b = bias.
 *
 * LEARNING RULE (Stochastic Gradient Descent):
 *   error  = ŷ - y_actual
 *   loss   = 0.5 * error²   (Mean Squared Error)
 *   w      ← w - η * error * x
 *   b      ← b - η * error
 *   where η (eta) = learning rate.
 *
 * FEATURES (x vector, 6-dimensional):
 *   x[0] = charCount              (total characters in chunk)
 *   x[1] = syllableCount         (total syllables — harder to write phonetically)
 *   x[2] = capitalCount          (uppercase letters slow handwriting motor)
 *   x[3] = technicalWordCount    (domain-specific words need careful writing)
 *   x[4] = symbolCount           (digits, math symbols require context switch)
 *   x[5] = wordCount             (raw word count baseline)
 *
 * WEIGHT INITIALIZATION:
 *   Initialized from the known handwriting physics baseline derived from the
 *   calibrated user profile (ms_per_char, complexity_sensitivity, etc.).
 *   This means the model starts smart (not random) and improves from there.
 *
 * PERSISTENCE:
 *   Weights are persisted to and loaded from the user's localStorage profile
 *   so the model retains learned parameters across sessions.
 */

const LEARNING_RATE = 0.000025; // η — small to avoid overshooting in high-magnitude ms targets
const L2_LAMBDA = 0.00001;      // L2 regularization to prevent weight explosion
const MIN_PREDICTION_MS = 1200; // Hard floor: even 1-word chunks need 1.2 seconds
const MAX_PREDICTION_MS = 60000; // Hard ceiling: 60 seconds max pause

/**
 * Extracts the 6-dimensional feature vector from a chunk analysis object.
 * @param {object} chunk - chunk from textChunker (has charCount, syllableCount, etc.)
 * @returns {number[]} - 6-element feature vector
 */
export function extractFeatureVector(chunk) {
  const charCount = chunk.charCount || 0;
  const syllableCount = chunk.syllableCount || 0;
  const capitalCount = (chunk.text || '').replace(/[^A-Z]/g, '').length;
  const technicalWordCount = (chunk.technicalWords || []).length;
  const symbolCount = (chunk.text || '').replace(/[^0-9$#@&%*+=\\/]/g, '').length;
  const wordCount = chunk.wordCount || 0;

  return [charCount, syllableCount, capitalCount, technicalWordCount, symbolCount, wordCount];
}

/**
 * Initializes weight vector from the user's calibration profile.
 * This "warm start" seeds the model with physics-derived estimates
 * so it doesn't have to learn from scratch.
 *
 * @param {object} profile - user pacing profile
 * @returns {{ weights: number[], bias: number }}
 */
export function initializeWeightsFromProfile(profile) {
  const msPerChar = profile?.ms_per_char || 380;
  const sensitivity = profile?.complexity_sensitivity || 1.4;

  // Warm-start weights derived from the handwriting physics model:
  // w[0]: ms per char (primary driver)
  // w[1]: syllable penalty — harder syllables = extra stroke time
  // w[2]: capital letter penalty (~80ms each from motor planning research)
  // w[3]: technical word penalty (~200ms per technical word)
  // w[4]: symbol penalty (~160ms per symbol)
  // w[5]: word count baseline contribution
  const weights = [
    msPerChar * sensitivity * 0.85, // per char, scaled by complexity
    60.0,                           // per syllable
    80.0,                           // per capital letter
    200.0,                          // per technical word
    160.0,                          // per symbol/digit
    (msPerChar * 5) * 0.15,         // per word (residual)
  ];

  const bias = 800; // base overhead: task switching, pen pickup, etc.
  return { weights, bias };
}

/**
 * Loads regression model weights from the profile object (persisted from localStorage).
 * Falls back to physics-derived warm start if not yet trained.
 *
 * @param {object} profile
 * @returns {{ weights: number[], bias: number }}
 */
export function loadModel(profile) {
  if (
    profile?.regression_weights &&
    Array.isArray(profile.regression_weights) &&
    profile.regression_weights.length === 6 &&
    typeof profile.regression_bias === 'number'
  ) {
    return {
      weights: [...profile.regression_weights],
      bias: profile.regression_bias,
    };
  }
  return initializeWeightsFromProfile(profile);
}

/**
 * Forward pass: predicts handwriting duration in milliseconds.
 * ŷ = w · x + b
 *
 * @param {number[]} weights
 * @param {number} bias
 * @param {number[]} featureVector
 * @returns {number} predicted ms
 */
export function predict(weights, bias, featureVector) {
  let yHat = bias;
  for (let i = 0; i < weights.length; i++) {
    yHat += weights[i] * featureVector[i];
  }
  return Math.max(MIN_PREDICTION_MS, Math.min(MAX_PREDICTION_MS, yHat));
}

/**
 * Performs ONE online SGD weight update step given a single training example.
 * Called immediately after user presses Space/Ready at end of each chunk.
 *
 * Update rule (with L2 regularization):
 *   error  = ŷ - y_actual
 *   w_i   ← w_i - η * (error * x_i + λ * w_i)
 *   b     ← b   - η * error
 *
 * @param {number[]} weights  - current weights (mutated in-place)
 * @param {number}   bias     - current bias
 * @param {number[]} featureVector - input features x
 * @param {number}   actualMs - ground truth: user's actual ready_time_ms
 * @returns {{ weights: number[], bias: number, loss: number, error: number }}
 */
export function sgdUpdate(weights, bias, featureVector, actualMs) {
  const yHat = predict(weights, bias, featureVector);
  const error = yHat - actualMs;
  const loss = 0.5 * error * error; // MSE loss for this single example

  // Update each weight: w_i ← w_i - η * (error * x_i + λ * w_i)
  const newWeights = weights.map((w, i) => {
    const gradient = error * featureVector[i] + L2_LAMBDA * w;
    return w - LEARNING_RATE * gradient;
  });

  // Update bias: b ← b - η * error
  const newBias = bias - LEARNING_RATE * error;

  return {
    weights: newWeights,
    bias: newBias,
    loss,
    error,
  };
}

/**
 * Serializes the trained model weights back into the profile object
 * so they persist to localStorage and Supabase across sessions.
 *
 * @param {object} profile
 * @param {number[]} weights
 * @param {number} bias
 * @param {number} lastLoss
 * @returns {object} updated profile
 */
export function serializeModelToProfile(profile, weights, bias, lastLoss) {
  return {
    ...profile,
    regression_weights: weights.map(w => Number(w.toFixed(4))),
    regression_bias: Number(bias.toFixed(2)),
    regression_last_loss: Number(lastLoss.toFixed(2)),
    regression_trained_chunks: (profile.regression_trained_chunks || 0) + 1,
  };
}

/**
 * Convenience function: run one complete training step from chunk data.
 * Used by useDictationEngine when a chunk completes (user presses Space).
 *
 * @param {object} params
 * @param {object} params.chunk        - chunk object from textChunker
 * @param {number} params.actualMs     - actual ready_time_ms recorded from user
 * @param {number[]} params.weights    - current model weights
 * @param {number}   params.bias       - current model bias
 * @returns {{ weights, bias, loss, error, predictedMs }}
 */
export function trainOnChunk({ chunk, actualMs, weights, bias }) {
  const featureVector = extractFeatureVector(chunk);
  const predictedMs = predict(weights, bias, featureVector);
  const { weights: newWeights, bias: newBias, loss, error } = sgdUpdate(
    weights,
    bias,
    featureVector,
    actualMs
  );
  return { weights: newWeights, bias: newBias, loss, error, predictedMs };
}

/**
 * Predict pause duration for a chunk using the trained model.
 * Returns seconds (float) for use by the dictation timer.
 *
 * @param {object} chunk
 * @param {number[]} weights
 * @param {number} bias
 * @returns {number} predicted pause in seconds
 */
export function predictPauseSec(chunk, weights, bias) {
  const featureVector = extractFeatureVector(chunk);
  const predictedMs = predict(weights, bias, featureVector);
  return Number((predictedMs / 1000).toFixed(1));
}
