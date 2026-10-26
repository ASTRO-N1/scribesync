// src/components/layout/KeyboardHints.jsx

export default function KeyboardHints() {
  const shortcuts = [
    { key: 'Space', desc: 'Ready / Done writing' },
    { key: 'R', desc: 'Replay chunk' },
    { key: '→', desc: 'Skip chunk' },
    { key: 'P', desc: 'Pause / Resume' },
    { key: 'Esc', desc: 'Exit session' },
  ];

  return (
    <div className="keyboard-hints">
      {shortcuts.map(s => (
        <div key={s.key} className="kbd-hint">
          <kbd className="kbd">{s.key}</kbd>
          <span>{s.desc}</span>
        </div>
      ))}
    </div>
  );
}
