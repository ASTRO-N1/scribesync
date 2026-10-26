// src/components/setup/TextInputArea.jsx
import { useState } from 'react';
import { countWords } from '../../lib/textChunker';
import ChunkPreview from './ChunkPreview';

const SAMPLE_TEXTS = {
  easy: "The rain started quietly in the late evening. We walked along the quiet streets near the old library and enjoyed the cool breeze before heading home.",
  technical: "Polymorphism enables subclass-specific method overrides with 99.8% precision. Asynchronous microservices optimize algorithmic throughput across distributed nodes.",
  math: `## Q2. Cryptarithmetic Problem: SEND + MORE = MONEY

### 1. Introduction
A cryptarithmetic problem is a mathematical puzzle where letters represent unique digits.

The given problem is:
\\[ \\begin{array}{rrrrr} &&S&E&N&D\\\\ +&&M&O&R&E\\\\ \\hline &M&O&N&E&Y \\end{array} \\]

Constraints:
1. All letters must represent distinct digits.
2. S ≠ 0 and M ≠ 0.
3. The equation SEND + MORE = MONEY must be satisfied.

Units column:
\\[ D + E = Y + 10C_1 \\]

Tens column:
\\[ N + R + C_1 = E + 10C_2 \\]

Hundreds column:
\\[ E + O + C_2 = N + 10C_3 \\]

Thousands column:
\\[ S + M + C_3 = O + 10C_4 \\]

Solution assignments:
\\[ \\begin{aligned} S&=9, & E&=5,\\\\ N&=6, & D&=7,\\\\ M&=1, & O&=0,\\\\ R&=8, & Y&=2 \\end{aligned} \\]

Verification:
# 9567
# + 1085
# 10652

Thus, 9567 + 1085 = 10652.`,
  table: `# CN Assignment: Go-Back-N vs Selective Repeat

### Comparison Table

| Go-Back-N | Selective Repeat |
| --- | --- |
| Retransmits the erroneous frame and subsequent frames. | Retransmits only lost or damaged frames. |
| Receiver discards out-of-order frames. | Receiver buffers out-of-order frames. |
| Simpler to implement. | More complex to implement. |
| Requires less receiver memory. | Requires more receiver memory. |
| Can cause more retransmissions. | Generally more efficient when errors occur. |

### Conclusion
Go-Back-N is simpler but retransmits multiple frames. Selective Repeat retransmits only affected frames.`,
};

export default function TextInputArea({
  value,
  onChange,
  disabled,
  chunkAnalysis,
  profile,
}) {
  const [showPreview, setShowPreview] = useState(false);
  const wordCount = countWords(value);

  // Estimated handwriting time based on profile WPM
  const wpm = profile?.handwriting_wpm || 22;
  const estimatedMins = wordCount > 0 ? (wordCount / wpm).toFixed(1) : 0;

  return (
    <div className="text-input-section">
      <div className="text-input-card">
        <div className="text-input-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className="text-input-title">Text to Dictate</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              (paste anything to write down)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className="word-count-tag">
              {wordCount > 0 ? `${wordCount} words · ~${estimatedMins} min writing` : 'Empty'}
            </span>
          </div>
        </div>

        <div className="text-input-body">
          <textarea
            id="source-text-input"
            placeholder="Paste your lecture notes, textbook excerpt, assignment answers, or study material here… ScribeSync will intelligently dictate it while you write."
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="text-input-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Quick samples:
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onChange(SAMPLE_TEXTS.easy)}
              disabled={disabled}
              style={{ fontSize: 'var(--text-xs)' }}
            >
              🌿 Simple Text
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onChange(SAMPLE_TEXTS.technical)}
              disabled={disabled}
              style={{ fontSize: 'var(--text-xs)' }}
            >
              ⚡ Technical Text
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onChange(SAMPLE_TEXTS.math)}
              disabled={disabled}
              style={{ fontSize: 'var(--text-xs)', borderColor: 'rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}
            >
              📐 Math & CSP Puzzle
            </button>
            <button
              id="sample-table-btn"
              className="btn btn-ghost btn-sm"
              onClick={() => onChange(SAMPLE_TEXTS.table)}
              disabled={disabled}
              style={{ fontSize: 'var(--text-xs)', borderColor: 'rgba(168, 85, 247, 0.3)', color: '#c084fc' }}
            >
              📊 Comparison Table (CN)
            </button>
          </div>

          {value && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onChange('')}
              disabled={disabled}
              style={{ color: 'var(--color-text-muted)' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Live dynamic chunking analysis bar */}
        {wordCount > 0 && chunkAnalysis && (
          <div className="chunk-analysis-bar">
            <div className="chunk-stat-pills">
              <span>Dynamic Chunker:</span>
              <span className="difficulty-badge easy">
                {chunkAnalysis.stats.easyCount} Simple
              </span>
              <span className="difficulty-badge medium">
                {chunkAnalysis.stats.mediumCount} Moderate
              </span>
              <span className="difficulty-badge hard">
                {chunkAnalysis.stats.hardCount} Technical
              </span>
            </div>

            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowPreview(v => !v)}
              style={{ color: 'var(--color-primary-light)', padding: '2px 8px' }}
            >
              {showPreview ? 'Hide Chunk Breakdown ▲' : `Inspect Chunks (${chunkAnalysis.chunks.length}) ▼`}
            </button>
          </div>
        )}
      </div>

      {showPreview && chunkAnalysis && (
        <ChunkPreview chunks={chunkAnalysis.chunks} />
      )}
    </div>
  );
}
