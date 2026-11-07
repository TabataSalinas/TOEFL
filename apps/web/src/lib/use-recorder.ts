'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Segment {
  start: number;
  end: number;
}

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  durationSec: number;
  transcript: string;
  confidence: number | null;
  /** Voice-activity segments in seconds from the start of the recording. */
  segments: Segment[];
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function pickMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? '';
}

/**
 * Microphone recorder with:
 *  - MediaRecorder for the audio file,
 *  - an AnalyserNode voice-activity detector (speech/silence segments → pauses),
 *  - the browser SpeechRecognition API for a client-side transcript (fallback when the
 *    server has no speech-to-text configured).
 */
export function useRecorder() {
  const [level, setLevel] = useState(0);
  const [micError, setMicError] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const vad = useRef({ segments: [] as Segment[], speaking: false, speechStart: 0, lastLoud: 0, loudSince: 0, floor: 0.01, samples: 0 });
  const startedAt = useRef(0);
  const meter = useRef<ReturnType<typeof setInterval> | null>(null);
  const recog = useRef<SpeechRecognitionLike | null>(null);
  const transcript = useRef<string[]>([]);
  const confs = useRef<number[]>([]);

  const ensureStream = useCallback(async (): Promise<MediaStream | null> => {
    if (streamRef.current && streamRef.current.active) return streamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      return stream;
    } catch (e) {
      setMicError((e as Error).message || 'Microphone unavailable');
      return null;
    }
  }, []);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    setLevel(Math.min(1, rms * 6));
    if (!recRef.current || recRef.current.state !== 'recording') return;

    const v = vad.current;
    const t = (performance.now() - startedAt.current) / 1000;
    // Calibrate the noise floor from the first 0.5 s.
    if (v.samples < 10) {
      v.floor = Math.max(v.floor, rms);
      v.samples++;
    }
    const threshold = Math.max(0.02, v.floor * 2.5);
    if (rms > threshold) {
      v.lastLoud = t;
      if (!v.speaking) {
        if (!v.loudSince) v.loudSince = t;
        if (t - v.loudSince >= 0.1) {
          v.speaking = true;
          v.speechStart = v.loudSince;
        }
      }
    } else {
      v.loudSince = 0;
      if (v.speaking && t - v.lastLoud >= 0.3) {
        v.segments.push({ start: v.speechStart, end: v.lastLoud });
        v.speaking = false;
      }
    }
  }, []);

  useEffect(() => {
    meter.current = setInterval(tick, 50);
    return () => {
      if (meter.current) clearInterval(meter.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      void ctxRef.current?.close();
    };
  }, [tick]);

  const start = useCallback(async (): Promise<boolean> => {
    const stream = await ensureStream();
    if (!stream) return false;
    await ctxRef.current?.resume();
    chunks.current = [];
    transcript.current = [];
    confs.current = [];
    vad.current = { segments: [], speaking: false, speechStart: 0, lastLoud: 0, loudSince: 0, floor: 0.01, samples: 0 };
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
    recRef.current = rec;
    startedAt.current = performance.now();
    rec.start(250);

    const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (SR) {
      try {
        const r = new SR();
        r.continuous = true;
        r.interimResults = false;
        r.lang = 'en-US';
        r.onresult = (e) => {
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const res = e.results[i];
            if (res.isFinal && res[0]) {
              transcript.current.push(res[0].transcript.trim());
              if (res[0].confidence > 0) confs.current.push(res[0].confidence);
            }
          }
        };
        r.onerror = () => undefined;
        r.onend = () => undefined;
        r.start();
        recog.current = r;
      } catch {
        recog.current = null;
      }
    }
    return true;
  }, [ensureStream]);

  const stop = useCallback(
    (): Promise<RecordingResult | null> =>
      new Promise((resolve) => {
        const rec = recRef.current;
        if (!rec || rec.state === 'inactive') return resolve(null);
        const duration = (performance.now() - startedAt.current) / 1000;
        const v = vad.current;
        if (v.speaking) v.segments.push({ start: v.speechStart, end: Math.min(duration, v.lastLoud || duration) });
        try {
          recog.current?.stop();
        } catch {
          /* ignore */
        }
        rec.onstop = () => {
          const mimeType = rec.mimeType || 'audio/webm';
          resolve({
            blob: new Blob(chunks.current, { type: mimeType }),
            mimeType,
            durationSec: Math.max(0.1, duration),
            transcript: transcript.current.join(' ').trim(),
            confidence: confs.current.length ? confs.current.reduce((a, b) => a + b, 0) / confs.current.length : null,
            segments: v.segments.filter((s) => s.end > s.start),
          });
        };
        rec.stop();
      }),
    [],
  );

  return { level, micError, ensureStream, start, stop, stream: streamRef };
}
