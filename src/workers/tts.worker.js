// src/workers/tts.worker.js
import { KokoroTTS } from 'kokoro-js';

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

let modelInstance = null;
let isInitializing = false;

self.onmessage = async (e) => {
  const { type, payload, id } = e.data || {};

  if (type === 'INIT') {
    if (modelInstance) {
      self.postMessage({ type: 'INIT_SUCCESS', id });
      return;
    }
    if (isInitializing) return;
    isInitializing = true;

    try {
      self.postMessage({
        type: 'INIT_PROGRESS',
        data: { pct: 25, file: 'Downloading Kokoro neural weights...' },
      });

      const handleProgress = (p) => {
        if (!p) return;
        if (p.status === 'progress') {
          const pct = p.total
            ? Math.min(85, Math.round((p.loaded / p.total) * 60) + 25)
            : 60;
          self.postMessage({
            type: 'INIT_PROGRESS',
            data: { pct, file: p.file ? p.file.split('/').pop() : 'model weights' },
          });
        } else if (p.status === 'done') {
          self.postMessage({
            type: 'INIT_PROGRESS',
            data: { pct: 85, file: 'compiling neural tensors...' },
          });
        }
      };

      let model;
      try {
        model = await KokoroTTS.from_pretrained(MODEL_ID, {
          dtype: 'q4',
          progress_callback: handleProgress,
        });
      } catch (q4Err) {
        console.warn('[TTS Worker] q4 load failed, trying fp32:', q4Err);
        model = await KokoroTTS.from_pretrained(MODEL_ID, {
          dtype: 'fp32',
          progress_callback: handleProgress,
        });
      }

      self.postMessage({
        type: 'INIT_PROGRESS',
        data: { pct: 90, file: 'Warming up voice & phonemizer...' },
      });

      // Warm-up inference
      try {
        await model.generate('Ready', { voice: 'af_heart' });
      } catch (wErr) {
        console.warn('[TTS Worker] Warm-up notice (non-fatal):', wErr);
      }

      modelInstance = model;
      isInitializing = false;
      self.postMessage({ type: 'INIT_SUCCESS', id });
    } catch (err) {
      console.error('[TTS Worker] Initialization failure:', err);
      isInitializing = false;
      self.postMessage({
        type: 'INIT_ERROR',
        id,
        error: err.message || 'Failed to initialize Kokoro in worker',
      });
    }
  } else if (type === 'GENERATE') {
    const { text, voice = 'af_heart', speed = 1.0 } = payload || {};
    if (!modelInstance) {
      self.postMessage({
        type: 'GENERATE_ERROR',
        id,
        error: 'Model not initialized in worker',
      });
      return;
    }

    try {
      const generated = await modelInstance.generate(text, { voice, speed });
      let wavBuffer;

      if (generated && typeof generated.toWav === 'function') {
        wavBuffer = generated.toWav();
      } else if (generated && generated.audio) {
        const audioData = generated.audio;
        const sampleRate = generated.sampling_rate || 24000;
        const dataSize = audioData.length * 2;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);
        const writeString = (v, offset, str) => {
          for (let i = 0; i < str.length; i++) v.setUint8(offset + i, str.charCodeAt(i));
        };
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);
        let offset = 44;
        for (let i = 0; i < audioData.length; i++) {
          let s = Math.max(-1, Math.min(1, audioData[i]));
          view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
          offset += 2;
        }
        wavBuffer = buffer;
      } else {
        throw new Error('Unrecognized raw audio format in worker');
      }

      // Zero-copy transfer of wavBuffer to main thread
      self.postMessage(
        {
          type: 'GENERATE_SUCCESS',
          id,
          payload: { wavBuffer, text, voice, speed },
        },
        [wavBuffer]
      );
    } catch (genErr) {
      self.postMessage({
        type: 'GENERATE_ERROR',
        id,
        error: genErr.message || 'Generation failed in worker',
      });
    }
  }
};
