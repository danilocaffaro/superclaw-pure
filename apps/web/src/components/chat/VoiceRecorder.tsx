'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

/**
 * F13 — Voice Recorder
 * Records audio via MediaRecorder API → WebM/Opus.
 * Shows recording timer, waveform preview, send/cancel buttons.
 */

interface VoiceRecorderProps {
  onSend: (blob: Blob, durationMs: number) => void;
  onCancel: () => void;
}

export function VoiceRecorder({ onSend, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
      });
      streamRef.current = stream;

      // Audio analysis for visual feedback
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start level monitoring
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const monitorLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(avg / 255);
        animFrameRef.current = requestAnimationFrame(monitorLevel);
      };
      monitorLevel();

      // MediaRecorder — prefer webm/opus, fallback to whatever's available
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 32000,
      });

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(100); // Collect data every 100ms
      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(Date.now() - startTimeRef.current);
      }, 100);
    } catch (err) {
      console.error('Microphone access denied:', err);
      onCancel();
    }
  }, [onCancel]);

  const stopAndSend = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      const durationMs = Date.now() - startTimeRef.current;
      onSend(blob, durationMs);
      cleanup();
    };
    recorder.stop();
  }, [onSend]);

  const cancel = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.onstop = () => cleanup();
      recorder.stop();
    } else {
      cleanup();
    }
    onCancel();
  }, [onCancel]);

  const cleanup = () => {
    setIsRecording(false);
    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    analyserRef.current = null;
  };

  // Auto-start on mount
  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Waveform bars
  const bars = 20;
  const barHeights = Array.from({ length: bars }, (_, i) => {
    const base = Math.sin(i * 0.5 + duration * 0.003) * 0.3 + 0.2;
    return Math.min(1, base + audioLevel * 0.8);
  });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 16px',
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
    }}>
      {/* Cancel */}
      <button
        onClick={cancel}
        style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(248,81,73,0.15)', border: 'none',
          color: 'var(--red, #F85149)', fontSize: 18,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ✕
      </button>

      {/* Waveform */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 2,
        height: 32,
      }}>
        {barHeights.map((h, i) => (
          <div key={i} style={{
            width: 3, borderRadius: 2,
            height: `${Math.max(4, h * 28)}px`,
            background: isRecording ? 'var(--coral)' : 'var(--text-muted)',
            transition: 'height 100ms',
          }} />
        ))}
      </div>

      {/* Timer */}
      <span style={{
        fontSize: 14, fontFamily: 'var(--font-mono)',
        color: isRecording ? 'var(--red, #F85149)' : 'var(--text-muted)',
        minWidth: 40,
      }}>
        {formatDuration(duration)}
      </span>

      {/* Recording indicator */}
      {isRecording && (
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: '#F85149',
          animation: 'pulse 1s infinite',
        }} />
      )}

      {/* Send */}
      <button
        onClick={stopAndSend}
        style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'var(--coral)', border: 'none',
          color: '#fff', fontSize: 18,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(245,158,11,0.3)',
        }}
      >
        ↑
      </button>
    </div>
  );
}
