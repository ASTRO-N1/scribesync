// src/components/setup/ChunkPreview.jsx
import DifficultyBadge from '../ui/DifficultyBadge';

export default function ChunkPreview({ chunks }) {
  if (!chunks || chunks.length === 0) return null;

  return (
    <div className="chunk-preview-container animate-fadeIn">
      <div className="chunk-preview-header">
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
          Dynamic Chunk Inspection ({chunks.length} chunks)
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          Targeted cognitive lengths
        </span>
      </div>

      <div className="chunk-preview-list">
        {chunks.map((c, i) => (
          <div key={i} className="chunk-preview-item">
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', minWidth: '24px' }}>
              #{i + 1}
            </span>
            <span className="chunk-preview-text">
              "{c.text}"
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <DifficultyBadge difficulty={c.difficulty} />
              <span className="chunk-preview-timing" title="Estimated handwriting pause">
                ⏱ {c.recommendedPauseSec}s
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
