// src/components/dictation/ChunkDisplay.jsx
import DifficultyBadge from '../ui/DifficultyBadge';

export default function ChunkDisplay({ chunk, isSpeaking }) {
  if (!chunk) return null;

  return (
    <div className="chunk-display-box">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <DifficultyBadge difficulty={chunk.difficulty} />
        {chunk.isTableCell && (
          <span style={{
            fontSize: 'var(--text-xs)',
            background: 'rgba(6, 182, 212, 0.15)',
            color: 'var(--color-accent)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 'var(--weight-semibold)',
          }}>
            📊 Table Row {chunk.rowNumber} of {chunk.totalRows}
          </span>
        )}
        {chunk.isTableIntro && (
          <span style={{
            fontSize: 'var(--text-xs)',
            background: 'rgba(139, 92, 246, 0.15)',
            color: 'var(--color-primary-light)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 'var(--weight-semibold)',
          }}>
            📊 Comparison Table Setup
          </span>
        )}
        {chunk.hasMath && !chunk.isTableCell && (
          <span style={{
            fontSize: 'var(--text-xs)',
            background: 'rgba(56, 189, 248, 0.15)',
            color: '#38bdf8',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 'var(--weight-semibold)',
          }}>
            📐 Math / STEM
          </span>
        )}
        {chunk.isHeader && (
          <span style={{
            fontSize: 'var(--text-xs)',
            background: 'rgba(168, 85, 247, 0.15)',
            color: 'var(--color-primary-light)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
          }}>
            📌 Section Header
          </span>
        )}
        {chunk.hasTechnical && !chunk.hasMath && !chunk.isTableCell && (
          <span style={{
            fontSize: 'var(--text-xs)',
            background: 'rgba(245, 158, 11, 0.12)',
            color: 'var(--color-warning)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
          }}>
            Technical term: {chunk.technicalWords?.join(', ')}
          </span>
        )}
      </div>

      {chunk.isTableCell ? (
        <div key={chunk.index} className="table-cell-display animate-fadeInUp">
          <div className="table-cell-banner">
            <span className="table-cell-row-tag">Row {chunk.rowNumber} of {chunk.totalRows}</span>
            <span className="table-cell-col-tag">Writing in: {chunk.columnHeader}</span>
          </div>

          <div className="table-cell-content">
            &ldquo;{chunk.cellText}&rdquo;
          </div>

          {chunk.tableHeaders && chunk.fullRow && (
            <div className="table-mini-preview">
              {chunk.tableHeaders.map((header, idx) => (
                <div
                  key={idx}
                  className={`table-mini-col ${idx === chunk.columnIndex ? 'active' : ''}`}
                >
                  <div className="table-mini-col-header">
                    {idx === chunk.columnIndex ? '▶ ' : ''}{header}
                  </div>
                  <div className="table-mini-col-val">{chunk.fullRow[idx] || '—'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : chunk.isTableIntro ? (
        <div key={chunk.index} className="table-intro-display animate-fadeInUp">
          <div className="table-intro-badge">📊 Comparison Table Setup</div>
          <h3 className="table-intro-title">{chunk.text}</h3>
          <div className="table-headers-chips">
            {chunk.tableHeaders?.map((h, i) => (
              <span key={i} className="table-header-chip">
                Column {i + 1}: <strong>{h}</strong>
              </span>
            ))}
          </div>
        </div>
      ) : chunk.isBlock || chunk.text.includes('\n') ? (
        <pre
          key={chunk.index}
          className="chunk-text animate-fadeInUp"
          style={{
            fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
            fontSize: 'var(--text-lg)',
            lineHeight: '1.5',
            whiteSpace: 'pre',
            textAlign: 'center',
            margin: 'var(--space-3) 0',
            padding: 'var(--space-3)',
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            color: '#e2e8f0',
          }}
        >
          {chunk.text}
        </pre>
      ) : (
        <p
          key={chunk.index}
          className="chunk-text animate-fadeInUp"
          style={{
            fontFamily: chunk.hasMath ? 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' : 'inherit',
            fontSize: chunk.hasMath ? 'var(--text-xl)' : 'inherit',
          }}
        >
          &ldquo;{chunk.text}&rdquo;
        </p>
      )}

      {chunk.spokenText && chunk.spokenText !== chunk.text && (
        <div style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-primary-light)',
          background: 'rgba(99, 102, 241, 0.08)',
          padding: '4px 10px',
          borderRadius: 'var(--radius-sm)',
          borderLeft: '3px solid var(--color-primary)',
          margin: 'var(--space-1) 0 var(--space-2) 0',
          textAlign: 'left',
          width: '100%',
        }}>
          🔊 <strong>Phonetic Dictation:</strong> &ldquo;{chunk.spokenText}&rdquo;
        </div>
      )}

      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
        {chunk.wordCount} words · {chunk.charCount} chars · {chunk.recommendedPauseSec ? `~${chunk.recommendedPauseSec}s writing pause` : ''}
      </span>
    </div>
  );
}
