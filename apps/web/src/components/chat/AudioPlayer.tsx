'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

/**
 * F14 — Inline audio player for voice messages.
 * Renders a waveform-style player inside the message bubble.
 */

interface AudioPlayerProps {
  src: string;
  durationMs?: number;
}

export function AudioPlayer({ src, durationMs }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(durationMs ? durationMs / 1000 : 0);
  const [currentTime, setCurrentTime] = useState(0);
  const animRef = useRef<number>(0);

  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    setProgress(audio.duration > 0 ? audio.currentTime / audio.duration : 0);
    if (!audio.paused) {
      animRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play().then(() => {
        setPlaying(true);
        animRef.current = requestAnimationFrame(updateProgress);
      }).catch(() => {});
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, [updateProgress]);

  const handleEnded = () => {
    setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio);
    setCurrentTime(audio.currentTime);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Generate static waveform bars (pseudo-random from src hash)
  const barCount = 30;
  const bars = Array.from({ length: barCount }, (_, i) => {
    const seed = (src.charCodeAt(i % src.length) * 7 + i * 13) % 100;
    return 0.2 + (seed / 100) * 0.8;
  });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px',
      minWidth: 220, maxWidth: 320,
    }}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
      />

      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--coral)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, color: '#fff', flexShrink: 0,
        }}
      >
        {playing ? '⏸' : '▶'}
      </button>

      {/* Waveform + progress */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          onClick={handleSeek}
          style={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            height: 24, cursor: 'pointer',
          }}
        >
          {bars.map((h, i) => {
            const barProgress = i / barCount;
            const isPlayed = barProgress <= progress;
            return (
              <div key={i} style={{
                width: 3, borderRadius: 2,
                height: `${Math.max(4, h * 22)}px`,
                background: isPlayed ? 'var(--coral)' : 'var(--text-muted)',
                opacity: isPlayed ? 1 : 0.4,
                transition: 'background 80ms',
              }} />
            );
          })}
        </div>

        {/* Duration */}
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {playing ? formatTime(currentTime) : formatTime(duration)}
        </span>
      </div>
    </div>
  );
}

/**
 * Detect if a message content is a voice message (file:// audio link).
 */
export function isVoiceMessage(content: string): string | null {
  // Match patterns like [Audio: voice-xxx.webm](file:///tmp/hiveclaw-uploads/voice-xxx.webm)
  const match = content.match(/\[(?:Audio|Voice)[^\]]*\]\((?:file:\/\/)?([^)]+\.(?:webm|mp4|ogg|m4a|wav))\)/i);
  if (match) return match[1];

  // Also match raw file URLs
  const urlMatch = content.match(/\/(?:api\/)?files\/uploads\/[^\s)]+\.(?:webm|mp4|ogg|m4a|wav)/i);
  if (urlMatch) return urlMatch[0];

  return null;
}
