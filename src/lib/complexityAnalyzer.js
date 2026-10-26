// src/lib/complexityAnalyzer.js
import { classifyWordWithScore } from './kMeansClassifier.js';

/**
 * Counts syllables in an English word using phonetic heuristics.
 */
export function countSyllables(word) {
  if (!word) return 0;
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (clean.length <= 3) return 1;

  // Replace problem patterns
  let modified = clean
    .replace(/(?:[^laeiouy]|ed|es|e)$/, '')
    .replace(/^y/, '');

  const matches = modified.match(/[aeiouy]{1,2}/g);
  return matches ? Math.max(1, matches.length) : 1;
}

/**
 * Evaluates individual word complexity (0.0 to 1.0).
 *
 * Uses ML Algorithm #3 (K-Means Classifier) as the PRIMARY classifier
 * for difficulty category and isTechnical detection, replacing the old
 * hardcoded TECHNICAL_TERMS Set. Rule-based heuristics for digits/symbols
 * are applied as SUPPLEMENTARY additive penalties on top.
 */
export function analyzeWord(word) {
  const clean = word.trim();
  const syllables = countSyllables(clean);
  const length = clean.length;

  // ── ML Algorithm #3: K-Means Clustering Classification ──────────────
  // classifyWordWithScore() runs the trained K-Means model to assign
  // this word to its nearest learned centroid (easy/medium/hard cluster).
  // The score returned is a continuous value in [0.1, 1.0] calibrated
  // to the centroid's distance from the "hard" cluster centroid.
  const kMeansResult = classifyWordWithScore(clean);
  let score = kMeansResult.score;        // Start from K-Means ML score
  const isTechnical = kMeansResult.isTechnical; // true if assigned to hard cluster

  // ── Supplementary Rule-Based Penalties ───────────────────────────────
  // These cover cases outside the vocabulary domain of the K-Means model
  // (numerals, mathematical symbols, ALL-CAPS acronyms).
  const hasDigits = /\d/.test(clean);
  const isAllCaps = clean.length >= 2 && clean === clean.toUpperCase() && /[A-Z]/.test(clean);
  const hasSymbols = /[/$#@&%*+=\\]/.test(clean);

  if (hasDigits) score = Math.min(1.0, score + 0.35);
  if (isAllCaps)  score = Math.min(1.0, score + 0.30);
  if (hasSymbols) score = Math.min(1.0, score + 0.35);

  const finalScore = Math.min(1.0, Math.max(0.1, Number(score.toFixed(2))));

  return {
    word: clean,
    syllables,
    length,
    isTechnical,
    hasDigits,
    isAllCaps,
    score: finalScore,
    category: finalScore < 0.35 ? 'easy' : finalScore < 0.65 ? 'medium' : 'hard',
    // Expose K-Means internals for debugging/explainability
    kMeansLabel: kMeansResult.category,
  };
}

/**
 * Analyzes an entire chunk or sentence.
 * Returns aggregate complexity, dominant category, and estimated handwriting stroke time.
 */
export function analyzeChunkComplexity(text, userProfile = null, hasMath = false) {
  if (!text || !text.trim()) {
    return {
      wordCount: 0,
      charCount: 0,
      totalSyllables: 0,
      averageScore: 0.1,
      difficulty: 'easy',
      hasTechnical: false,
      hasDigits: false,
      hasMath: false,
      technicalWords: [],
      estimatedHandwriteMs: 0,
    };
  }

  const words = text.trim().split(/\s+/).filter(Boolean);
  const analyzedWords = words.map(analyzeWord);

  const charCount = text.length;
  const totalSyllables = analyzedWords.reduce((sum, w) => sum + w.syllables, 0);
  const totalScore = analyzedWords.reduce((sum, w) => sum + w.score, 0);
  const averageScore = Number((totalScore / (words.length || 1)).toFixed(2));

  const technicalWords = analyzedWords.filter(w => w.isTechnical || w.score >= 0.75).map(w => w.word);
  const hasTechnical = technicalWords.length > 0;
  const hasDigits = analyzedWords.some(w => w.hasDigits);

  // Difficulty tier: Math/STEM chunks require high precision and slower writing
  let difficulty = 'easy';
  if (hasMath || averageScore >= 0.60 || hasTechnical || hasDigits) {
    difficulty = 'hard';
  } else if (averageScore >= 0.35) {
    difficulty = 'medium';
  }

  // Calculate realistic estimated handwriting duration:
  // Base stroke time per character (default ~380ms for adult handwriting)
  const baseMsPerChar = userProfile?.ms_per_char || 380;
  const complexitySensitivity = userProfile?.complexity_sensitivity || 1.4;

  // Difficult words slow the handwriting stroke down
  const difficultyMultiplier = 1.0 + (averageScore * (complexitySensitivity - 1.0));
  
  // Extra pause for capitals, numbers, symbols, and mathematical notations
  const capitalBonus = (text.match(/[A-Z]/g) || []).length * 80;
  const symbolBonus = (text.match(/[\d/$#@&%*+=≠≤≥∈∉±×÷√∑∏₀-₉⁰-⁹]/g) || []).length * 160;
  const mathBonus = hasMath ? 1200 : 0;

  // Punctuation cadence breathing time
  let punctuationMs = 0;
  if (/[.?!]$/.test(text.trim())) {
    punctuationMs = 1200; // sentence completion breathing pause
  } else if (/[,;:—–]$/.test(text.trim())) {
    punctuationMs = 600; // clause breathing pause
  }

  const rawHandwritingMs = (charCount * baseMsPerChar * difficultyMultiplier) + capitalBonus + symbolBonus + mathBonus + punctuationMs;
  const estimatedHandwriteMs = Math.round(Math.max(1500, rawHandwritingMs));

  return {
    wordCount: words.length,
    charCount,
    totalSyllables,
    averageScore,
    difficulty,
    hasTechnical,
    hasDigits,
    hasMath,
    technicalWords,
    analyzedWords,
    estimatedHandwriteMs,
  };
}
