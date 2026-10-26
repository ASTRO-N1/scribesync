// src/components/ui/DifficultyBadge.jsx

export default function DifficultyBadge({ difficulty, size = 'sm' }) {
  const diff = difficulty?.toLowerCase() || 'easy';

  const label =
    diff === 'hard'
      ? '⚡ Technical'
      : diff === 'medium'
      ? '✦ Moderate'
      : '● Simple';

  return (
    <span className={`difficulty-badge ${diff} ${size === 'lg' ? 'btn-lg' : ''}`}>
      {label}
    </span>
  );
}
