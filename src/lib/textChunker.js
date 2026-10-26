import { analyzeWord, analyzeChunkComplexity } from './complexityAnalyzer.js';
import { DEFAULTS, LIMITS } from '../constants.js';
import { preprocessTextForDictation } from './mathSpeechNormalizer.js';
import { selectArm, loadBanditState, BANDIT_ARMS } from './chunkBandit.js';

const SENTENCE_SPLIT_REGEX = /(?<=[.?!])\s+(?=[A-Z0-9"'])/;
const CLAUSE_PUNCTUATION_REGEX = /[,;:—–]/;
const CONJUNCTIONS = new Set(['and', 'but', 'or', 'so', 'yet', 'because', 'although', 'whereas', 'while', 'since', 'which', 'that']);

/**
 * Splits text into natural sentences.
 */
export function splitIntoSentences(text) {
  if (!text || !text.trim()) return [];
  const normalized = text.trim().replace(/\r\n/g, '\n').replace(/\s+/g, ' ');
  const parts = normalized.split(SENTENCE_SPLIT_REGEX);
  
  return parts.map(part => part.trim()).filter(Boolean);
}

/**
 * Intelligent Dynamic Text Chunker.
 * Adapts chunk length based on word difficulty, cognitive load,
 * clause boundaries, user profile capacities, and mathematical content.
 */
export function chunkText(text, options = {}) {
  if (!text || !text.trim()) {
    return {
      chunks: [],
      stats: { totalWords: 0, totalChunks: 0, easyCount: 0, mediumCount: 0, hardCount: 0, avgComplexity: 0 }
    };
  }

  const profile = options.profile || {};

  // ── ML Algorithm #2: UCB1 Multi-Armed Bandit Capacity Selection ────────
  // Load the persisted bandit state and ask it for the optimal chunk size
  // for each difficulty tier. The bandit's answer replaces the profile
  // capacity once it has accumulated enough experience (>= 3 pulls per arm).
  // If the bandit hasn't explored enough yet, we fall back to profile values.
  const banditState = loadBanditState(profile);

  const banditHasData = (tier) => {
    const tierState = banditState[tier];
    return tierState && tierState.totalPulls >= BANDIT_ARMS.length; // at least 1 pull per arm
  };

  const banditEasyCap  = banditHasData('easy')   ? selectArm(banditState, 'easy')   : null;
  const banditMedCap   = banditHasData('medium')  ? selectArm(banditState, 'medium') : null;
  const banditHardCap  = banditHasData('hard')    ? selectArm(banditState, 'hard')   : null;

  // Merge: use bandit recommendation when available, else profile/defaults
  const easyCap = Math.max(3, Math.min(LIMITS.MAX_WORDS_PER_CHUNK,
    banditEasyCap ?? profile.easy_chunk_capacity ?? DEFAULTS.EASY_CHUNK_CAPACITY));
  const medCap  = Math.max(2, Math.min(easyCap,
    banditMedCap  ?? profile.medium_chunk_capacity ?? DEFAULTS.MEDIUM_CHUNK_CAPACITY));
  const hardCap = Math.max(LIMITS.MIN_WORDS_PER_CHUNK, Math.min(medCap,
    banditHardCap ?? profile.hard_chunk_capacity ?? DEFAULTS.HARD_CHUNK_CAPACITY));

  // 1. Preprocess document into structured logical segments (math, equations, headers, lists, prose)
  const segments = preprocessTextForDictation(text);
  const rawChunks = [];

  for (const seg of segments) {
    const wordCount = countWords(seg.displayText);

    // Atomic segments: preserve blocks, tables, cryptarithmetic grids, equations, headers, labels, or compact sentences
    if (seg.isBlock || seg.isEquation || seg.isHeader || seg.isLabel || seg.isTableIntro || seg.isTableCell || wordCount <= Math.max(easyCap, 8)) {
      const words = seg.displayText.trim().split(/\s+/).filter(Boolean);
      const chunkComplexity = analyzeChunkComplexity(seg.displayText, profile, seg.hasMath);
      const estimatedSeconds = Number((chunkComplexity.estimatedHandwriteMs / 1000).toFixed(1));
      const pauseMultiplier = Number((estimatedSeconds / (DEFAULTS.PAUSE_DURATION || 3.2)).toFixed(2));

      rawChunks.push({
        text: seg.displayText,
        spokenText: seg.spokenText || seg.displayText,
        words,
        wordCount: words.length,
        charCount: seg.displayText.length,
        syllableCount: chunkComplexity.totalSyllables,
        complexityScore: chunkComplexity.averageScore,
        difficulty: chunkComplexity.difficulty,
        hasTechnical: chunkComplexity.hasTechnical,
        technicalWords: chunkComplexity.technicalWords,
        hasDigits: chunkComplexity.hasDigits,
        hasMath: seg.hasMath || false,
        isHeader: seg.isHeader || false,
        isBlock: seg.isBlock || false,
        isTableIntro: seg.isTableIntro || false,
        isTableCell: seg.isTableCell || false,
        rowNumber: seg.rowNumber || null,
        totalRows: seg.totalRows || null,
        columnHeader: seg.columnHeader || null,
        columnIndex: seg.columnIndex ?? null,
        totalColumns: seg.totalColumns || null,
        cellText: seg.cellText || null,
        fullRow: seg.fullRow || null,
        tableHeaders: seg.tableHeaders || null,
        recommendedPauseSec: estimatedSeconds,
        pauseMultiplier,
        isSentenceEnd: true,
        punctuationEnd: seg.displayText.slice(-1),
      });
    } else {
      // Long sentences: break down into natural clauses
      const sentenceChunks = chunkSentence(seg.displayText, {
        easyCap,
        medCap,
        hardCap,
        profile,
        hasMath: seg.hasMath,
        spokenText: seg.spokenText,
      });
      rawChunks.push(...sentenceChunks);
    }
  }

  // Assign index and total
  const chunks = rawChunks.map((c, i) => ({
    ...c,
    index: i,
    total: rawChunks.length,
  }));

  // Aggregate stats
  const totalWords = chunks.reduce((sum, c) => sum + c.wordCount, 0);
  const easyCount = chunks.filter(c => c.difficulty === 'easy').length;
  const mediumCount = chunks.filter(c => c.difficulty === 'medium').length;
  const hardCount = chunks.filter(c => c.difficulty === 'hard').length;
  const avgComplexity = chunks.length > 0
    ? Number((chunks.reduce((s, c) => s + c.complexityScore, 0) / chunks.length).toFixed(2))
    : 0;

  return {
    chunks,
    stats: {
      totalWords,
      totalChunks: chunks.length,
      easyCount,
      mediumCount,
      hardCount,
      avgComplexity,
    }
  };
}

/**
 * Chunks an individual sentence dynamically.
 */
function chunkSentence(sentence, { easyCap, medCap, hardCap, profile, hasMath = false, spokenText = null }) {
  const words = sentence.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const analyzedWords = words.map(analyzeWord);
  const chunks = [];
  let i = 0;

  while (i < words.length) {
    let accumulatedScore = 0;
    let wordCount = 0;
    let currentDifficulty = 'easy';

    // Decide dynamic capacity based on the upcoming words
    let j = i;
    while (j < words.length) {
      const w = analyzedWords[j];
      accumulatedScore += w.score;
      wordCount += 1;

      const currentAvg = accumulatedScore / wordCount;
      if (currentAvg >= 0.55 || w.score >= 0.7) {
        currentDifficulty = 'hard';
      } else if (currentAvg >= 0.35) {
        currentDifficulty = 'medium';
      }

      // Max word limit for this tier
      const maxForTier = currentDifficulty === 'hard' ? hardCap : currentDifficulty === 'medium' ? medCap : easyCap;

      // Check if we hit or exceeded the target limit
      if (wordCount >= Math.floor(maxForTier)) {
        // Look ahead for punctuation snap within 1 word
        if (j + 1 < words.length && CLAUSE_PUNCTUATION_REGEX.test(words[j])) {
          j += 1; // natural comma/colon boundary
        } else if (j + 1 < words.length && CLAUSE_PUNCTUATION_REGEX.test(words[j + 1]) && wordCount < maxForTier + 1) {
          j += 2; // snap to punctuation next word
        } else {
          j += 1;
        }
        break;
      }

      // If we encounter a punctuation boundary early (after at least 2 words), take it
      if (wordCount >= 2 && CLAUSE_PUNCTUATION_REGEX.test(w.word)) {
        j += 1;
        break;
      }

      j += 1;
    }

    const chunkWords = words.slice(i, j);
    const chunkText = chunkWords.join(' ');
    const chunkComplexity = analyzeChunkComplexity(chunkText, profile, hasMath);

    // Dynamic pause calculation for this chunk
    // Base pause in seconds derived from handwriting estimation
    const estimatedSeconds = Number((chunkComplexity.estimatedHandwriteMs / 1000).toFixed(1));
    const pauseMultiplier = Number((estimatedSeconds / (DEFAULTS.PAUSE_DURATION || 3.2)).toFixed(2));

    const isSentenceEnd = /[.?!]$/.test(chunkText.trim());

    chunks.push({
      text: chunkText,
      spokenText: (words.length === chunkWords.length && spokenText) ? spokenText : chunkText,
      words: chunkWords,
      wordCount: chunkWords.length,
      charCount: chunkText.length,
      syllableCount: chunkComplexity.totalSyllables,
      complexityScore: chunkComplexity.averageScore,
      difficulty: chunkComplexity.difficulty,
      hasTechnical: chunkComplexity.hasTechnical,
      technicalWords: chunkComplexity.technicalWords,
      hasDigits: chunkComplexity.hasDigits,
      hasMath,
      recommendedPauseSec: estimatedSeconds,
      pauseMultiplier,
      isSentenceEnd,
      punctuationEnd: chunkText.slice(-1),
    });

    i = j;
  }

  return chunks;
}

export function countWords(text) {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}
