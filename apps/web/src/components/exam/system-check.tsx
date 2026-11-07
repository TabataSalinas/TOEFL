'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge, Card } from '@/components/ui';
import { speakText } from '@/lib/audio';

export interface CheckResult {
  mic: boolean;
  camera: boolean;
  speaker: boolean;
}

/**
 * Pre-exam equipment check: requests microphone (required for Speaking) and camera
 * (optional preview), shows a live input meter, and plays a test sound.
 */
export function SystemCheck({ onDone }: { onDone: (r: CheckResult) => void }) {
  const [mic, setMic] = useState<'idle' | 'ok' | 'error'>('idle');
  const [cam, setCam] = useState<'idle' | 'ok' | 'error'>('idle');
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [heard, setHeard] = useState(false);
  const [speakerOk, setSpeakerOk] = useState(false);
  const [err, setErr] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streams = useRef<MediaStream[]>([]);
  const raf = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      streams.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    },
    [],
  );

  const testMic = async () => {
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streams.current.push(stream);
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const loop = () => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const l = Math.min(1, Math.sqrt(sum / buf.length) * 8);
        setLevel(l);
        setPeak((p) => Math.max(p, l));
        if (l > 0.15) setHeard(true);
        raf.current = requestAnimationFrame(loop);
      };
      loop();
      setMic('ok');
    } catch (e) {
      setMic('error');
      setErr(`Microphone blocked or unavailable: ${(e as Error).message}`);
    }
  };

  const testCam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 } });
      streams.current.push(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCam('ok');
    } catch {
      setCam('error');
    }
  };

  const testSpeaker = () => {
    speakText('Audio check. If you can hear this sentence, your speakers or headphones are working.', 'Woman').done.then(() => setSpeakerOk(true));
  };

  const ready = mic === 'ok' && heard;

  return (
    <Card>
      <h2 className="text-lg font-semibold">Equipment check</h2>
      <p className="mt-1 text-sm muted">
        Like the real test, the Speaking section records your voice automatically. Allow microphone access, speak for a moment, and
        check that the meter moves. The camera is optional and only previews your setup locally (nothing is uploaded).
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <div className="flex items-center gap-2">
            <button className="btn-primary" onClick={testMic}>1. Test microphone</button>
            <Badge tone={mic === 'ok' ? 'good' : mic === 'error' ? 'bad' : 'default'}>{mic === 'ok' ? 'Connected' : mic === 'error' ? 'Blocked' : 'Not tested'}</Badge>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full" style={{ background: 'rgb(var(--border))' }} role="meter" aria-label="Microphone level" aria-valuenow={Math.round(level * 100)}>
            <div className="h-full bg-green-500 transition-all" style={{ width: `${level * 100}%` }} />
          </div>
          <p className="mt-1 text-xs muted">
            {mic !== 'ok' ? 'Press the button and allow access.' : heard ? 'Voice detected ✔' : 'Say “testing, one, two, three” …'} (peak {Math.round(peak * 100)}%)
          </p>

          <div className="mt-4 flex items-center gap-2">
            <button className="btn-ghost" onClick={testSpeaker}>2. Test speakers</button>
            <Badge tone={speakerOk ? 'good' : 'default'}>{speakerOk ? 'Played' : 'Not tested'}</Badge>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button className="btn-ghost" onClick={testCam}>3. Camera preview (optional)</button>
            <Badge tone={cam === 'ok' ? 'good' : cam === 'error' ? 'warn' : 'default'}>{cam === 'ok' ? 'On' : cam === 'error' ? 'Unavailable' : 'Off'}</Badge>
          </div>
        </div>
        <div className="aspect-video overflow-hidden rounded-xl bg-black/80">
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" aria-label="Camera preview" />
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
      <div className="mt-5 flex items-center justify-between">
        <span className="text-xs muted">{ready ? 'Ready for the Speaking section.' : 'Microphone and voice detection are required for Speaking.'}</span>
        <button
          className="btn-primary"
          disabled={!ready}
          onClick={() => {
            streams.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
            streams.current = [];
            onDone({ mic: mic === 'ok', camera: cam === 'ok', speaker: speakerOk });
          }}
        >
          Continue
        </button>
      </div>
    </Card>
  );
}
