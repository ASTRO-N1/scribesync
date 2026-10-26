// src/components/ModelLoader.jsx

export default function ModelLoader({
  progress = 0,
  loadingMessage = 'Loading neural weights…',
  error = null,
  onRetry,
}) {
  return (
    <div className="kokoro-blocking-loader-overlay">
      <div className="kokoro-loader-card animate-scaleIn">
        <div className="loader-icon-pulse">🎙️</div>

        <h2>Loading Kokoro-82M Engine</h2>

        <p>
          {error
            ? 'An error occurred while loading the neural model.'
            : loadingMessage || 'Downloading Kokoro neural weights to your browser…'}
        </p>

        <div className="kokoro-loader-track">
          <div
            className="kokoro-loader-fill"
            style={{ width: `${Math.max(8, progress)}%` }}
          />
        </div>

        <div className="loader-meta-row">
          <span>{progress}% loaded</span>
          <span>Cached in browser after first download</span>
        </div>

        {error && (
          <div className="loader-error-box animate-fadeIn">
            <p>⚠️ {error}</p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onRetry}
            >
              🔄 Retry Download
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
